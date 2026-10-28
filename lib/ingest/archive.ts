import { createHash } from "node:crypto";
import { unzipSync, type UnzipFileInfo } from "fflate";
import { classifyPath, compileGitignore, LIMITS, looksBinary, normalizeEntryPath, sanitizeContent, type SkipReason } from "@/lib/code-intelligence/filter";
import { detectLanguage } from "@/lib/code-intelligence/languages";

export class ArchiveError extends Error {
  constructor(
    public code: "invalid_archive" | "archive_too_large" | "archive_bomb" | "empty_archive",
    message: string,
  ) {
    super(message);
  }
}

export type ArchiveFile = {
  path: string;
  language: string | null;
  content: string;
  sizeBytes: number;
  lineCount: number;
  contentHash: string;
};

export type ArchiveResult = {
  files: ArchiveFile[];
  skipped: Partial<Record<SkipReason, number>>;
  redactions: number;
  totalBytes: number;
};

type Entry = { raw: string; path: string; size: number; originalSize: number };

const decoder = new TextDecoder("utf-8", { fatal: false });

function listEntries(zip: Uint8Array): Entry[] {
  const entries: Entry[] = [];
  let declaredTotal = 0;
  try {
    unzipSync(zip, {
      filter(info: UnzipFileInfo) {
        if (entries.length >= LIMITS.maxArchiveEntries) {
          throw new ArchiveError("archive_too_large", `Archive has more than ${LIMITS.maxArchiveEntries} entries`);
        }
        if (info.name.endsWith("/")) return false;
        declaredTotal += info.originalSize;
        if (declaredTotal > LIMITS.maxUncompressedBytes) {
          throw new ArchiveError("archive_bomb", "Archive expands beyond the allowed uncompressed size");
        }
        if (info.originalSize > 1024 * 1024 && info.size > 0 && info.originalSize / info.size > LIMITS.maxCompressionRatio) {
          throw new ArchiveError("archive_bomb", "Archive contains an entry with a suspicious compression ratio");
        }
        const path = normalizeEntryPath(info.name);
        if (path === null) throw new ArchiveError("invalid_archive", `Unsafe path in archive: ${info.name.slice(0, 120)}`);
        entries.push({ raw: info.name, path, size: info.size, originalSize: info.originalSize });
        return false;
      },
    });
  } catch (error) {
    if (error instanceof ArchiveError) throw error;
    throw new ArchiveError("invalid_archive", "The file is not a valid ZIP archive");
  }
  return entries;
}

function readEntries(zip: Uint8Array, wanted: Map<string, Entry>): Record<string, Uint8Array> {
  const data = unzipSync(zip, { filter: (info) => wanted.has(info.name) });
  for (const [raw, bytes] of Object.entries(data)) {
    const declared = wanted.get(raw)!.originalSize;
    if (bytes.length > declared) throw new ArchiveError("archive_bomb", "Archive entry is larger than declared");
  }
  return data;
}

/**
 * Safely reads a ZIP archive in memory (nothing is written to disk and nothing is executed).
 * GitHub zipballs wrap everything in one top-level folder, which is stripped.
 */
export function extractArchive(zip: Uint8Array): ArchiveResult {
  if (zip.length > LIMITS.maxArchiveBytes) {
    throw new ArchiveError("archive_too_large", `Archive exceeds ${Math.round(LIMITS.maxArchiveBytes / 1024 / 1024)} MB`);
  }
  if (zip.length < 4 || zip[0] !== 0x50 || zip[1] !== 0x4b) {
    throw new ArchiveError("invalid_archive", "The file is not a valid ZIP archive");
  }

  const entries = listEntries(zip);
  if (entries.length === 0) throw new ArchiveError("empty_archive", "The archive contains no files");

  const roots = new Set(entries.map((e) => e.path.split("/")[0]));
  const strip = roots.size === 1 && entries.every((e) => e.path.includes("/"));
  for (const e of entries) if (strip) e.path = e.path.slice(e.path.indexOf("/") + 1);

  const byPath = new Map(entries.map((e) => [e.path, e]));
  const gitignoreEntry = byPath.get(".gitignore");
  let gitignore: ((p: string) => boolean) | undefined;
  if (gitignoreEntry && gitignoreEntry.originalSize < 64 * 1024) {
    const data = readEntries(zip, new Map([[gitignoreEntry.raw, gitignoreEntry]]));
    gitignore = compileGitignore(decoder.decode(data[gitignoreEntry.raw]));
  }

  const skipped: Partial<Record<SkipReason, number>> = {};
  const skip = (r: SkipReason) => (skipped[r] = (skipped[r] ?? 0) + 1);
  const wanted = new Map<string, Entry>();
  let budget = 0;
  for (const e of entries.sort((a, b) => a.path.localeCompare(b.path))) {
    const reason = classifyPath(e.path, gitignore);
    if (reason) {
      skip(reason);
      continue;
    }
    if (e.originalSize > LIMITS.maxFileBytes) {
      skip("too-large");
      continue;
    }
    if (wanted.size >= LIMITS.maxIndexedFiles || budget + e.originalSize > LIMITS.maxTotalBytes) {
      skip("limit");
      continue;
    }
    budget += e.originalSize;
    wanted.set(e.raw, e);
  }

  const data = wanted.size ? readEntries(zip, wanted) : {};
  const files: ArchiveFile[] = [];
  let redactions = 0;
  let totalBytes = 0;
  for (const [raw, bytes] of Object.entries(data)) {
    const entry = wanted.get(raw)!;
    if (looksBinary(bytes)) {
      skip("binary");
      continue;
    }
    const sanitized = sanitizeContent(decoder.decode(bytes).replace(/\r\n/g, "\n"));
    if (!sanitized) {
      skip("secret");
      continue;
    }
    redactions += sanitized.redactions;
    totalBytes += bytes.length;
    files.push({
      path: entry.path,
      language: detectLanguage(entry.path).language,
      content: sanitized.content,
      sizeBytes: bytes.length,
      lineCount: sanitized.content.length === 0 ? 0 : sanitized.content.split("\n").length,
      contentHash: createHash("sha256").update(bytes).digest("hex"),
    });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { files, skipped, redactions, totalBytes };
}

/** Detects ecosystems and frameworks from manifest files; used to focus web searches. */
export function detectManifest(files: { path: string; content: string }[]) {
  const ecosystems = new Set<string>();
  const frameworks = new Set<string>();
  const get = (p: string) => files.find((f) => f.path === p)?.content;
  const pkg = get("package.json");
  if (pkg) {
    ecosystems.add("npm");
    try {
      const json = JSON.parse(pkg) as { dependencies?: Record<string, string>; devDependencies?: Record<string, string> };
      const deps = { ...json.dependencies, ...json.devDependencies };
      for (const name of ["next", "react", "vue", "svelte", "express", "@nestjs/core", "fastify", "electron", "@angular/core", "vite"]) {
        if (deps[name]) frameworks.add(`${name.replace("@nestjs/core", "nestjs").replace("@angular/core", "angular")}${deps[name] ? ` ${deps[name].replace(/^[\^~]/, "")}` : ""}`);
      }
    } catch {
      // Malformed package.json: ecosystem still recorded, frameworks unknown.
    }
  }
  const py = [get("requirements.txt"), get("pyproject.toml"), get("Pipfile")].filter(Boolean).join("\n");
  if (py) {
    ecosystems.add("pip");
    for (const name of ["django", "flask", "fastapi", "numpy", "pandas", "pytest", "torch"]) {
      if (new RegExp(`\\b${name}\\b`, "i").test(py)) frameworks.add(name);
    }
  }
  const jvm = [get("pom.xml"), get("build.gradle"), get("build.gradle.kts")].filter(Boolean).join("\n");
  if (jvm) {
    ecosystems.add(get("pom.xml") ? "maven" : "gradle");
    if (/spring-boot/i.test(jvm)) frameworks.add("spring-boot");
  }
  if (get("CMakeLists.txt")) ecosystems.add("cmake");
  if (files.some((f) => f.path === "Makefile")) ecosystems.add("make");
  return { ecosystems: [...ecosystems], frameworks: [...frameworks] };
}
