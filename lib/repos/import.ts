import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { getAuth } from "@/lib/auth";
import { getDb, schema } from "@/lib/db";
import { env } from "@/lib/env";
import { ApiError } from "@/lib/security/api";
import { log } from "@/lib/observability/log";
import { ArchiveError, extractArchive } from "@/lib/ingest/archive";
import { downloadZipball, fetchRepoMetadata, GitHubError, parseGitHubInput, resolveCommit, type GitHubRef } from "@/lib/ingest/github";
import { storeArchive } from "@/lib/ingest/indexer";

const { repository, account } = schema;

export const MAX_UPLOAD_BYTES = 4 * 1024 * 1024;

/** Returns the user's own GitHub OAuth token (decrypted by Better Auth), if they connected GitHub. */
async function userGitHubToken(userId: string, headers: Headers): Promise<{ token: string | null; scopes: string[] }> {
  const db = await getDb();
  const [acct] = await db.select({ scope: account.scope, id: account.id }).from(account).where(and(eq(account.userId, userId), eq(account.providerId, "github"))).limit(1);
  if (!acct) return { token: null, scopes: [] };
  try {
    const res = await getAuth().api.getAccessToken({ body: { accountId: acct.id, userId }, headers });
    return { token: res?.accessToken ?? null, scopes: (acct.scope ?? "").split(/[ ,]+/).filter(Boolean) };
  } catch {
    return { token: null, scopes: [] };
  }
}

function mapArchiveError(error: unknown): never {
  if (error instanceof ArchiveError) {
    const status = error.code === "archive_too_large" ? 413 : 400;
    throw new ApiError(status, status === 413 ? "payload_too_large" : "invalid_request", error.message);
  }
  if (error instanceof GitHubError) {
    throw new ApiError(error.status === 413 ? 413 : error.status === 404 ? 404 : error.status === 429 ? 429 : 502, error.status === 413 ? "payload_too_large" : error.status === 404 ? "not_found" : error.status === 429 ? "rate_limited" : "upstream_error", error.message);
  }
  throw error;
}

export async function importFromGitHub(userId: string, input: string, headers: Headers) {
  const ref: GitHubRef | null = parseGitHubInput(input);
  if (!ref) throw new ApiError(400, "invalid_request", "Enter a GitHub repository as owner/name or https://github.com/owner/name");

  const { token: userToken } = await userGitHubToken(userId, headers);
  const serverToken = env().GITHUB_TOKEN ?? null;
  const token = userToken ?? serverToken;

  try {
    const meta = await fetchRepoMetadata(ref, token);
    // A server-wide token may see its owner's private repos; never let other users import those.
    if (meta.isPrivate && !userToken) throw new ApiError(404, "not_found", "Repository not found, or you don't have access to it");
    if (meta.sizeKb > 200 * 1024) throw new ApiError(413, "payload_too_large", "Repository is larger than the 200 MB limit for indexing");
    const branch = ref.ref ?? meta.defaultBranch;
    const sha = await resolveCommit(ref, branch, token);

    const db = await getDb();
    const [existing] = await db
      .select()
      .from(repository)
      .where(and(eq(repository.ownerId, userId), eq(repository.fullName, meta.fullName), eq(repository.commitSha, sha)))
      .orderBy(desc(repository.createdAt))
      .limit(1);
    if (existing && existing.status !== "failed" && existing.status !== "cancelled") {
      return { repo: existing, job: null, existing: true };
    }

    const zip = await downloadZipball(ref, sha, token);
    const archive = extractArchive(zip);
    if (archive.files.length === 0) throw new ApiError(400, "invalid_request", "No indexable source files were found in this repository");

    const [repo] = existing
      ? [existing]
      : await db
          .insert(repository)
          .values({ ownerId: userId, source: "github", name: meta.name, fullName: meta.fullName, htmlUrl: meta.htmlUrl, ref: branch, commitSha: sha, isPrivate: meta.isPrivate, status: "downloading" })
          .returning();
    const job = await storeArchive(repo.id, userId, archive);
    log("info", "import.github", { repoId: repo.id, files: archive.files.length, skipped: archive.skipped, redactions: archive.redactions });
    return { repo, job, existing: false, skipped: archive.skipped, redactions: archive.redactions };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    mapArchiveError(error);
  }
}

export async function importFromZip(userId: string, file: File) {
  if (file.size > MAX_UPLOAD_BYTES) throw new ApiError(413, "payload_too_large", "ZIP uploads are limited to 4 MB. Import large projects from GitHub instead.");
  const name = file.name.replace(/\.zip$/i, "").replace(/[^\w.-]+/g, "-").slice(0, 80) || "upload";
  const bytes = new Uint8Array(await file.arrayBuffer());
  try {
    const archive = extractArchive(bytes);
    if (archive.files.length === 0) throw new ApiError(400, "invalid_request", "No indexable source files were found in this archive");
    const db = await getDb();
    const [repo] = await db
      .insert(repository)
      .values({ ownerId: userId, source: "zip", name, fullName: `upload/${name}`, status: "downloading" })
      .returning();
    const job = await storeArchive(repo.id, userId, archive);
    return { repo, job, existing: false, skipped: archive.skipped, redactions: archive.redactions };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    mapArchiveError(error);
  }
}

/** Fetches the latest commit; replaces files only when the source changed (or when forced). */
export async function reindexGitHub(userId: string, repo: typeof repository.$inferSelect, headers: Headers) {
  const ref = parseGitHubInput(repo.fullName);
  if (!ref) throw new ApiError(400, "invalid_request", "Repository source is no longer valid");
  const { token: userToken } = await userGitHubToken(userId, headers);
  const token = userToken ?? (repo.isPrivate ? null : (env().GITHUB_TOKEN ?? null));
  try {
    const sha = await resolveCommit(ref, repo.ref ?? "HEAD", token);
    const zip = await downloadZipball(ref, sha, token);
    const archive = extractArchive(zip);
    const db = await getDb();
    await db.update(repository).set({ commitSha: sha }).where(eq(repository.id, repo.id));
    const job = await storeArchive(repo.id, userId, archive);
    return { job, changed: sha !== repo.commitSha };
  } catch (error) {
    if (error instanceof ApiError) throw error;
    mapArchiveError(error);
  }
}
