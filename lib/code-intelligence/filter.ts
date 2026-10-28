import { detectLanguage } from "./languages";

export const LIMITS = {
  maxFileBytes: 400 * 1024,
  maxIndexedFiles: 3000,
  maxTotalBytes: 40 * 1024 * 1024,
  maxArchiveBytes: 30 * 1024 * 1024,
  maxArchiveEntries: 25000,
  maxUncompressedBytes: 200 * 1024 * 1024,
  maxCompressionRatio: 200,
} as const;

export type SkipReason =
  | "ignored-directory"
  | "lockfile"
  | "secret"
  | "binary"
  | "generated"
  | "too-large"
  | "gitignore"
  | "unknown-type"
  | "limit";

const IGNORED_DIRS = new Set([
  "node_modules", ".git", ".hg", ".svn", "dist", "build", "out", ".next", ".nuxt", ".svelte-kit",
  "coverage", "vendor", "target", "__pycache__", ".venv", "venv", ".tox", ".mypy_cache",
  ".pytest_cache", ".gradle", ".idea", "Pods", ".turbo", ".cache", ".parcel-cache", "bower_components",
  ".terraform", ".serverless", ".vercel", ".output", "obj", "cmake-build-debug", "cmake-build-release",
]);

const LOCKFILES = new Set([
  "package-lock.json", "yarn.lock", "pnpm-lock.yaml", "bun.lockb", "bun.lock", "poetry.lock", "pipfile.lock",
  "cargo.lock", "composer.lock", "gemfile.lock", "go.sum", "uv.lock", "npm-shrinkwrap.json",
]);

const SECRET_NAMES = [
  /^\.env(\..*)?$/i,
  /^\.envrc$/i,
  /\.(pem|key|p12|pfx|jks|keystore|kdbx|ppk|asc|gpg|crt|cer|der)$/i,
  /^id_(rsa|dsa|ecdsa|ed25519)(\.pub)?$/i,
  /^(credentials|secrets?|service[-_]?account.*)\.(json|ya?ml|toml|ini)$/i,
  /^\.(npmrc|pypirc|netrc|pgpass|git-credentials|htpasswd)$/i,
  /^.*\.tfstate(\.backup)?$/i,
];

const BINARY_EXT = /\.(png|jpe?g|gif|bmp|ico|webp|avif|svgz|tiff?|psd|mp[34]|mov|avi|mkv|webm|wav|flac|ogg|zip|tar|gz|tgz|bz2|xz|7z|rar|jar|war|class|o|a|so|dylib|dll|exe|bin|wasm|pdf|docx?|xlsx?|pptx?|ttf|otf|woff2?|eot|sqlite3?|db|pyc|pyo|node|dat|iso|dmg)$/i;

const GENERATED = /(\.min\.(js|css)|\.map|\.bundle\.js|\.chunk\.js|_pb2\.py|\.pb\.go|\.generated\.\w+|\.d\.ts\.map)$/i;

/** Minimal .gitignore support: plain names, `dir/`, leading `/` anchors, `*` and `**` globs. Negations are honored. */
export function compileGitignore(content: string) {
  const rules: { re: RegExp; negate: boolean; dirOnly: boolean }[] = [];
  for (const raw of content.split(/\r?\n/)) {
    let line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    let negate = false;
    if (line.startsWith("!")) {
      negate = true;
      line = line.slice(1);
    }
    const dirOnly = line.endsWith("/");
    if (dirOnly) line = line.slice(0, -1);
    const anchored = line.startsWith("/") || line.includes("/");
    line = line.replace(/^\//, "");
    const body = line
      .split("")
      .map((c) => (/[.+^${}()|[\]\\]/.test(c) ? `\\${c}` : c))
      .join("")
      .replace(/\*\*\/?/g, "\u0000")
      .replace(/\*/g, "[^/]*")
      .replace(/\?/g, "[^/]")
      .replace(/\u0000/g, "(?:.*/)?");
    const re = new RegExp(`${anchored ? "^" : "(?:^|/)"}${body}(?:/.*)?$`);
    rules.push({ re, negate, dirOnly });
  }
  return (path: string) => {
    let ignored = false;
    for (const r of rules) if (r.re.test(path)) ignored = !r.negate;
    return ignored;
  };
}

export function classifyPath(path: string, isIgnoredByGitignore?: (p: string) => boolean): SkipReason | null {
  const segments = path.split("/");
  const base = segments[segments.length - 1];
  if (segments.slice(0, -1).some((s) => IGNORED_DIRS.has(s))) return "ignored-directory";
  if (SECRET_NAMES.some((re) => re.test(base))) return "secret";
  if (LOCKFILES.has(base.toLowerCase())) return "lockfile";
  if (BINARY_EXT.test(base)) return "binary";
  if (GENERATED.test(base)) return "generated";
  if (isIgnoredByGitignore?.(path)) return "gitignore";
  if (!detectLanguage(path).language) return "unknown-type";
  return null;
}

export function looksBinary(bytes: Uint8Array) {
  const n = Math.min(bytes.length, 8000);
  for (let i = 0; i < n; i++) if (bytes[i] === 0) return true;
  return false;
}

const PRIVATE_KEY = /-----BEGIN (?:[A-Z]+ )?PRIVATE KEY-----/;

const TOKEN_PATTERNS: RegExp[] = [
  /\bAKIA[0-9A-Z]{16}\b/g,
  /\bgh[pousr]_[A-Za-z0-9]{36,}\b/g,
  /\bgithub_pat_[A-Za-z0-9_]{40,}\b/g,
  /\bsk-(?:proj-|ant-)?[A-Za-z0-9_-]{20,}\b/g,
  /\bxox[abprs]-[A-Za-z0-9-]{10,}\b/g,
  /\bAIza[0-9A-Za-z_-]{35}\b/g,
  /\btvly-[A-Za-z0-9-]{20,}\b/g,
];

/** Returns null when the file must be excluded entirely, otherwise content with obvious tokens redacted. */
export function sanitizeContent(text: string): { content: string; redactions: number } | null {
  if (PRIVATE_KEY.test(text)) return null;
  let redactions = 0;
  let content = text;
  for (const re of TOKEN_PATTERNS) {
    content = content.replace(re, () => {
      redactions++;
      return "[REDACTED_SECRET]";
    });
  }
  return { content, redactions };
}

/** Rejects archive entry names that are absolute, escape the root, or contain control characters. */
export function normalizeEntryPath(name: string): string | null {
  if (!name || name.length > 1024) return null;
  if (/[\u0000-\u001f]/.test(name) || name.includes("\\")) return null;
  if (name.startsWith("/") || /^[a-zA-Z]:/.test(name)) return null;
  const parts = name.split("/").filter((p) => p !== "" && p !== ".");
  if (parts.some((p) => p === "..")) return null;
  return parts.join("/");
}
