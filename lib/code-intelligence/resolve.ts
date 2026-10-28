import path from "node:path/posix";
import type { ImportKind } from "./parser";
import type { ParsedLanguage } from "./languages";

export type Resolution =
  | { kind: "internal"; targetPath: string }
  | { kind: "external"; packageName: string }
  | { kind: "unresolved" };

type Alias = { prefix: string; targets: string[] };

export type ResolverContext = {
  files: Set<string>;
  /** TypeScript `compilerOptions.paths`, already joined with baseUrl and relative to repo root. */
  aliases: Alias[];
  baseUrl: string | null;
  /** Java fully-qualified class name -> file path. */
  javaClasses: Map<string, string>;
  /** basename -> paths, for C/C++ include fallback. */
  byBasename: Map<string, string[]>;
  pythonRoots: string[];
};

const JS_EXTS = [".ts", ".tsx", ".mts", ".cts", ".js", ".jsx", ".mjs", ".cjs", ".d.ts"];

/** Parses tsconfig/jsconfig JSON (which allows comments and trailing commas). */
export function parseTsconfig(text: string): { baseUrl: string | null; paths: Record<string, string[]> } {
  try {
    const stripped = text
      .replace(/("(?:\\.|[^"\\])*")|\/\/[^\n]*|\/\*[\s\S]*?\*\//g, (_m, str) => str ?? "")
      .replace(/,(\s*[}\]])/g, "$1");
    const json = JSON.parse(stripped) as { compilerOptions?: { baseUrl?: string; paths?: Record<string, string[]> } };
    return { baseUrl: json.compilerOptions?.baseUrl ?? null, paths: json.compilerOptions?.paths ?? {} };
  } catch {
    return { baseUrl: null, paths: {} };
  }
}

export function buildResolverContext(paths: string[], tsconfigs: { dir: string; text: string }[]): ResolverContext {
  const files = new Set(paths);
  const aliases: Alias[] = [];
  let baseUrl: string | null = null;
  for (const cfg of tsconfigs) {
    const parsed = parseTsconfig(cfg.text);
    const base = path.normalize(path.join(cfg.dir, parsed.baseUrl ?? "."));
    if (parsed.baseUrl && cfg.dir === ".") baseUrl = base === "." ? "" : base;
    for (const [pattern, targets] of Object.entries(parsed.paths)) {
      aliases.push({
        prefix: pattern.replace(/\*$/, ""),
        targets: targets.map((t) => path.normalize(path.join(base, t.replace(/\*$/, "")))).map((t) => (t === "." ? "" : t)),
      });
    }
  }
  aliases.sort((a, b) => b.prefix.length - a.prefix.length);

  const javaClasses = new Map<string, string>();
  const byBasename = new Map<string, string[]>();
  const pythonRoots = new Set<string>([""]);
  for (const p of paths) {
    const base = p.split("/").pop()!;
    byBasename.set(base, [...(byBasename.get(base) ?? []), p]);
    if (p.endsWith(".java")) {
      const m = p.match(/(?:^|\/)(?:src\/(?:main|test)\/java\/)?((?:[A-Za-z_]\w*\/)*[A-Za-z_]\w*)\.java$/);
      if (m) javaClasses.set(m[1].replace(/\//g, "."), p);
      const idx = p.indexOf("/java/");
      if (idx >= 0) javaClasses.set(p.slice(idx + 6, -5).replace(/\//g, "."), p);
    }
    if (p.endsWith(".py")) {
      const parts = p.split("/");
      if (parts[0] === "src" && parts.length > 2) pythonRoots.add("src");
    }
  }
  return { files, aliases, baseUrl, javaClasses, byBasename, pythonRoots: [...pythonRoots] };
}

function tryJsFile(ctx: ResolverContext, candidate: string): string | null {
  const c = path.normalize(candidate);
  if (c.startsWith("..")) return null;
  if (ctx.files.has(c)) return c;
  const noJs = c.replace(/\.(m|c)?jsx?$/, "");
  for (const ext of JS_EXTS) {
    if (ctx.files.has(noJs + ext)) return noJs + ext;
  }
  for (const ext of JS_EXTS) {
    const idx = path.join(c, `index${ext}`);
    if (ctx.files.has(idx)) return idx;
  }
  return null;
}

function packageNameOf(spec: string) {
  if (spec.startsWith("node:")) return spec;
  const parts = spec.split("/");
  return spec.startsWith("@") ? parts.slice(0, 2).join("/") : parts[0];
}

export function resolveImport(
  ctx: ResolverContext,
  fromPath: string,
  lang: ParsedLanguage,
  spec: string,
  kind: ImportKind,
): Resolution {
  const dir = path.dirname(fromPath);

  if (lang === "typescript" || lang === "tsx" || lang === "javascript") {
    if (spec.startsWith(".") || spec.startsWith("/")) {
      const hit = tryJsFile(ctx, spec.startsWith("/") ? spec.slice(1) : path.join(dir, spec));
      return hit ? { kind: "internal", targetPath: hit } : { kind: "unresolved" };
    }
    for (const alias of ctx.aliases) {
      if (spec === alias.prefix.replace(/\/$/, "") || spec.startsWith(alias.prefix)) {
        const rest = spec.slice(alias.prefix.length);
        for (const target of alias.targets) {
          const hit = tryJsFile(ctx, path.join(target || ".", rest));
          if (hit) return { kind: "internal", targetPath: hit };
        }
        return { kind: "unresolved" };
      }
    }
    if (ctx.baseUrl !== null) {
      const hit = tryJsFile(ctx, path.join(ctx.baseUrl || ".", spec));
      if (hit) return { kind: "internal", targetPath: hit };
    }
    return { kind: "external", packageName: packageNameOf(spec) };
  }

  if (lang === "python") {
    const m = spec.match(/^(\.*)(.*)$/)!;
    const dots = m[1].length;
    const modPath = m[2] ? m[2].split(".").join("/") : "";
    const bases = dots > 0 ? [path.normalize(path.join(dir, ...Array(dots - 1).fill("..")))] : ctx.pythonRoots;
    for (const base of bases) {
      const root = base === "." ? "" : base;
      const joined = modPath ? path.join(root || ".", modPath) : root || ".";
      for (const cand of [`${joined}.py`, `${joined}/__init__.py`, `${joined}.pyi`]) {
        const c = path.normalize(cand);
        if (ctx.files.has(c)) return { kind: "internal", targetPath: c };
      }
    }
    if (dots > 0) return { kind: "unresolved" };
    const top = spec.split(".")[0];
    const isLocalPackage = [...ctx.files].some((f) => f.startsWith(`${top}/`) || f === `${top}.py` || f.startsWith(`src/${top}/`));
    return isLocalPackage ? { kind: "unresolved" } : { kind: "external", packageName: top };
  }

  if (lang === "java") {
    const clean = spec.replace(/\.\*$/, "");
    let cur = clean;
    while (cur.includes(".")) {
      const hit = ctx.javaClasses.get(cur);
      if (hit) return { kind: "internal", targetPath: hit };
      cur = cur.slice(0, cur.lastIndexOf("."));
    }
    if (/^(java|javax|jdk|sun|kotlin|android)\./.test(spec)) return { kind: "external", packageName: spec.split(".").slice(0, 2).join(".") };
    const prefix = spec.split(".").slice(0, 2).join(".");
    const local = [...ctx.javaClasses.keys()].some((k) => k.startsWith(prefix + "."));
    return local ? { kind: "unresolved" } : { kind: "external", packageName: prefix };
  }

  // C / C++
  if (kind === "include-system") {
    // Projects often use <project/header.h> with an include dir; treat a unique suffix match as internal.
    const local = (ctx.byBasename.get(spec.split("/").pop()!) ?? []).filter((p) => p === spec || p.endsWith(`/${spec}`));
    if (local.length === 1 && spec.includes("/")) return { kind: "internal", targetPath: local[0] };
    return { kind: "external", packageName: spec };
  }
  for (const cand of [path.join(dir, spec), spec, path.join("include", spec), path.join("src", spec)]) {
    const c = path.normalize(cand);
    if (ctx.files.has(c)) return { kind: "internal", targetPath: c };
  }
  const byName = ctx.byBasename.get(spec.split("/").pop()!) ?? [];
  const suffixMatches = byName.filter((p) => p.endsWith(spec));
  if (suffixMatches.length === 1) return { kind: "internal", targetPath: suffixMatches[0] };
  return { kind: "unresolved" };
}
