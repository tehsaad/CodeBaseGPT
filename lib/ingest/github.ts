import { LIMITS } from "@/lib/code-intelligence/filter";

export class GitHubError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export type GitHubRef = { owner: string; repo: string; ref: string | null };

const OWNER = /^[A-Za-z0-9](?:[A-Za-z0-9-]{0,38})$/;
const REPO = /^[A-Za-z0-9._-]{1,100}$/;
const REF = /^[A-Za-z0-9._\/-]{1,200}$/;

/**
 * Accepts `owner/repo`, `owner/repo@ref`, or a github.com URL. We never fetch the user's URL:
 * it is reduced to owner/repo/ref and API URLs are built from those parts (SSRF-safe).
 */
export function parseGitHubInput(input: string): GitHubRef | null {
  const value = input.trim();
  if (!value || value.length > 300) return null;
  let owner: string | undefined;
  let repo: string | undefined;
  let ref: string | null = null;

  if (/^[\w.-]+\/[\w.-]+(@[\w./-]+)?$/.test(value)) {
    const [path, at] = value.split("@");
    [owner, repo] = path.split("/");
    ref = at ?? null;
  } else {
    let url: URL;
    try {
      url = new URL(value.startsWith("http") ? value : `https://${value}`);
    } catch {
      return null;
    }
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!["github.com", "www.github.com"].includes(url.hostname.toLowerCase())) return null;
    if (url.username || url.password || (url.port && url.port !== "443")) return null;
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts.length < 2) return null;
    [owner, repo] = parts;
    if (parts[2] === "tree" && parts.length > 3) ref = decodeURIComponent(parts.slice(3).join("/"));
  }
  repo = repo?.replace(/\.git$/, "");
  if (!owner || !repo || !OWNER.test(owner) || !REPO.test(repo) || repo === "." || repo === "..") return null;
  if (ref !== null && (!REF.test(ref) || ref.includes(".."))) return null;
  return { owner, repo, ref };
}

const API = "https://api.github.com";

function headers(token?: string | null, accept = "application/vnd.github+json") {
  return {
    Accept: accept,
    "User-Agent": "CodeBaseGPT-indexer",
    "X-GitHub-Api-Version": "2022-11-28",
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function gh(path: string, token?: string | null, accept?: string) {
  const res = await fetch(`${API}${path}`, { headers: headers(token, accept), signal: AbortSignal.timeout(15_000), redirect: "error" });
  if (res.status === 404) throw new GitHubError(404, "Repository not found, or you don't have access to it");
  if (res.status === 401) throw new GitHubError(401, "GitHub rejected the access token. Reconnect GitHub in Settings.");
  if (res.status === 403 || res.status === 429) {
    const remaining = res.headers.get("x-ratelimit-remaining");
    throw new GitHubError(429, remaining === "0" ? "GitHub API rate limit reached. Connect GitHub or try again later." : "GitHub refused the request");
  }
  if (!res.ok) throw new GitHubError(502, `GitHub responded with ${res.status}`);
  return res;
}

export type RepoMetadata = {
  fullName: string;
  name: string;
  htmlUrl: string;
  defaultBranch: string;
  isPrivate: boolean;
  sizeKb: number;
};

export async function fetchRepoMetadata(ref: GitHubRef, token?: string | null): Promise<RepoMetadata> {
  const res = await gh(`/repos/${ref.owner}/${ref.repo}`, token);
  const j = (await res.json()) as { full_name: string; name: string; html_url: string; default_branch: string; private: boolean; size: number };
  return { fullName: j.full_name, name: j.name, htmlUrl: j.html_url, defaultBranch: j.default_branch, isPrivate: j.private, sizeKb: j.size };
}

export async function resolveCommit(ref: GitHubRef, branch: string, token?: string | null): Promise<string> {
  const res = await gh(`/repos/${ref.owner}/${ref.repo}/commits/${encodeURIComponent(branch)}`, token, "application/vnd.github.sha");
  const sha = (await res.text()).trim();
  if (!/^[0-9a-f]{40}$/.test(sha)) throw new GitHubError(502, "GitHub returned an unexpected commit id");
  return sha;
}

async function readCapped(res: Response, cap: number): Promise<Uint8Array> {
  const declared = Number(res.headers.get("content-length") ?? 0);
  if (declared > cap) throw new GitHubError(413, `Repository archive exceeds ${Math.round(cap / 1024 / 1024)} MB`);
  const reader = res.body?.getReader();
  if (!reader) throw new GitHubError(502, "Empty archive response");
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.length;
    if (total > cap) {
      await reader.cancel();
      throw new GitHubError(413, `Repository archive exceeds ${Math.round(cap / 1024 / 1024)} MB`);
    }
    chunks.push(value);
  }
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

/** Downloads the zipball for an exact commit. Only follows a redirect to GitHub's archive host. */
export async function downloadZipball(ref: GitHubRef, sha: string, token?: string | null): Promise<Uint8Array> {
  const first = await fetch(`${API}/repos/${ref.owner}/${ref.repo}/zipball/${sha}`, {
    headers: headers(token),
    redirect: "manual",
    signal: AbortSignal.timeout(20_000),
  });
  let res = first;
  if (first.status >= 300 && first.status < 400) {
    const location = first.headers.get("location");
    const target = location ? new URL(location) : null;
    if (!target || target.protocol !== "https:" || target.hostname !== "codeload.github.com") {
      throw new GitHubError(502, "GitHub redirected to an unexpected host");
    }
    res = await fetch(target, { headers: { "User-Agent": "CodeBaseGPT-indexer" }, redirect: "error", signal: AbortSignal.timeout(60_000) });
  }
  if (res.status === 404) throw new GitHubError(404, "Repository archive not found");
  if (!res.ok) throw new GitHubError(502, `Archive download failed (${res.status})`);
  return readCapped(res, LIMITS.maxArchiveBytes);
}
