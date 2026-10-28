import "server-only";
import { and, eq, inArray, sql } from "drizzle-orm";
import { getDb, rowsOf, schema } from "@/lib/db";
import type { Evidence } from "@/lib/ai/retrieval";

const { repoFile, codeSymbol } = schema;

type Repo = typeof schema.repository.$inferSelect;

export type EntryPoint = { fileId: string; path: string; line: number | null; why: string };

const ENTRY_NAMES = /(^|\/)(main\.(py|c|cc|cpp|go|java|[cm]?[jt]s)|index\.[cm]?[jt]sx?|server\.[cm]?[jt]s|app\.[cm]?[jt]s|manage\.py|wsgi\.py|asgi\.py|cli\.[cm]?[jt]s|__main__\.py)$/i;
const ROUTE_FILE = /(^|\/)(app\/(.+\/)?(route|page|layout)\.[jt]sx?|pages\/.+\.[jt]sx?|routes?\/.+\.[jt]sx?|controllers?\/.+|urls\.py|views\.py)$/i;

/** Deterministic facts about a repository, computed from the index (no model involved). */
export async function repoFacts(repo: Repo) {
  const db = await getDb();
  const files = await db.select({ id: repoFile.id, path: repoFile.path, language: repoFile.language, lines: repoFile.lineCount }).from(repoFile).where(eq(repoFile.repositoryId, repo.id));
  const byPath = new Map(files.map((f) => [f.path, f]));

  // Modules: top-level folders (or second level under src/) with sizes.
  const moduleOf = (p: string) => {
    const parts = p.split("/");
    if (parts.length === 1) return "(root)";
    return ["src", "lib", "app", "packages", "apps"].includes(parts[0]) && parts.length > 2 ? `${parts[0]}/${parts[1]}` : parts[0];
  };
  const modules = new Map<string, { files: number; lines: number }>();
  for (const f of files) {
    const m = moduleOf(f.path);
    const cur = modules.get(m) ?? { files: 0, lines: 0 };
    modules.set(m, { files: cur.files + 1, lines: cur.lines + f.lines });
  }

  // Most depended-on files (distinct importers).
  const hubs = rowsOf<{ id: string; path: string; n: number }>(
    await db.execute(sql`select f.id, f.path, count(distinct i.file_id)::int as n from file_import i join repo_file f on f.id = i.target_file_id
      where i.repository_id = ${repo.id} and i.file_id <> i.target_file_id group by f.id, f.path order by n desc limit 8`),
  );

  // Entry points: manifest declarations, conventional names, and main functions found in the source.
  const entries: EntryPoint[] = [];
  const pkg = files.find((f) => f.path === "package.json");
  if (pkg) {
    const [row] = await db.select({ content: repoFile.content }).from(repoFile).where(eq(repoFile.id, pkg.id));
    try {
      const json = JSON.parse(row.content) as { main?: string; module?: string; bin?: string | Record<string, string>; scripts?: Record<string, string> };
      const declared = [json.main, json.module, ...(typeof json.bin === "string" ? [json.bin] : Object.values(json.bin ?? {}))].filter((x): x is string => Boolean(x));
      for (const d of declared) {
        const clean = d.replace(/^\.\//, "");
        const hit = byPath.get(clean) ?? files.find((f) => f.path.replace(/\.[^.]+$/, "") === clean.replace(/\.[^.]+$/, "").replace(/^dist\//, "src/"));
        if (hit) entries.push({ fileId: hit.id, path: hit.path, line: null, why: "declared in package.json" });
      }
      if (json.scripts?.start || json.scripts?.dev) entries.push({ fileId: pkg.id, path: pkg.path, line: null, why: `scripts: ${["dev", "start", "build", "test"].filter((s) => json.scripts?.[s]).join(", ")}` });
    } catch {
      // Malformed package.json: skip manifest-declared entry points.
    }
  }
  const mains = rowsOf<{ id: string; path: string; content: string }>(
    await db.execute(sql`select id, path, content from repo_file where repository_id = ${repo.id} and (
      content like ${'%if __name__ == "__main__"%'} or content like ${"%if __name__ == '__main__'%"} or content like ${"%static void main(%"} or content ~ ${"(^|\\n)\\s*int\\s+main\\s*\\("}) limit 12`),
  );
  for (const m of mains) {
    const line = m.content.split("\n").findIndex((l) => /__name__\s*==|static void main\(|^\s*int\s+main\s*\(/.test(l)) + 1;
    entries.push({ fileId: m.id, path: m.path, line: line || null, why: "defines a program main" });
  }
  for (const f of files) {
    if (entries.length >= 16) break;
    if (entries.some((e) => e.path === f.path)) continue;
    if (ENTRY_NAMES.test(f.path) && f.path.split("/").length <= 3) entries.push({ fileId: f.id, path: f.path, line: null, why: "conventional entry file name" });
  }
  const routes = files.filter((f) => ROUTE_FILE.test(f.path)).slice(0, 20).map((f) => ({ fileId: f.id, path: f.path }));

  const readme = files.find((f) => /^readme(\.md|\.txt|\.rst)?$/i.test(f.path));
  const symbolCount = repo.symbolCount;

  return {
    repo: { name: repo.fullName, commit: repo.commitSha?.slice(0, 7) ?? null, indexedAt: repo.lastIndexedAt, files: repo.fileCount, lines: repo.totalLines, symbols: symbolCount, skipped: repo.skippedCount, frameworks: repo.manifest?.frameworks ?? [], ecosystems: repo.manifest?.ecosystems ?? [] },
    languages: [...files.reduce((m, f) => m.set(f.language ?? "other", (m.get(f.language ?? "other") ?? 0) + f.lines), new Map<string, number>()).entries()].sort((a, b) => b[1] - a[1]).slice(0, 6),
    modules: [...modules.entries()].map(([path, v]) => ({ path, ...v })).sort((a, b) => b.lines - a.lines).slice(0, 12),
    hubs: hubs.map((h) => ({ fileId: h.id, path: h.path, importers: h.n })),
    entries,
    routes,
    readme: readme ? { fileId: readme.id, path: readme.path } : null,
  };
}

export type RepoFacts = Awaited<ReturnType<typeof repoFacts>>;

/** Evidence for overview-style generation: README head, entry points, and the most depended-on files. */
export async function overviewEvidence(repoId: string, facts: RepoFacts, budgetChars = 20_000): Promise<Evidence[]> {
  const db = await getDb();
  const wanted: { fileId: string; start: number; end: number; reason: Evidence["reason"] }[] = [];
  if (facts.readme) wanted.push({ fileId: facts.readme.fileId, start: 1, end: 70, reason: "overview" });
  for (const e of facts.entries.slice(0, 5)) wanted.push({ fileId: e.fileId, start: Math.max(1, (e.line ?? 1) - 5), end: (e.line ?? 1) + 40, reason: "overview" });
  for (const h of facts.hubs.slice(0, 5)) wanted.push({ fileId: h.fileId, start: 1, end: 45, reason: "overview" });
  const seen = new Set<string>();
  const unique = wanted.filter((w) => (seen.has(w.fileId) ? false : (seen.add(w.fileId), true)));
  if (!unique.length) return [];
  const rows = await db.select({ id: repoFile.id, path: repoFile.path, language: repoFile.language, content: repoFile.content, lines: repoFile.lineCount }).from(repoFile).where(and(eq(repoFile.repositoryId, repoId), inArray(repoFile.id, unique.map((u) => u.fileId))));
  const byId = new Map(rows.map((r) => [r.id, r]));
  const symbols = await db.select({ fileId: codeSymbol.fileId, name: codeSymbol.name, startLine: codeSymbol.startLine }).from(codeSymbol).where(inArray(codeSymbol.fileId, unique.map((u) => u.fileId)));
  const out: Evidence[] = [];
  let used = 0;
  for (const w of unique) {
    const f = byId.get(w.fileId);
    if (!f) continue;
    const end = Math.min(f.lines || 1, w.end);
    const content = f.content.split("\n").slice(w.start - 1, end).join("\n");
    if (!content.trim() || used + content.length > budgetChars) continue;
    used += content.length;
    const sym = symbols.find((s) => s.fileId === f.id && s.startLine >= w.start && s.startLine <= end);
    out.push({ label: `C${out.length + 1}`, fileId: f.id, path: f.path, language: f.language, startLine: w.start, endLine: end, content, symbol: sym?.name ?? null, reason: w.reason });
  }
  return out;
}

/** Renders the deterministic facts as a compact block the model may rely on (and the UI shows directly). */
export function factsBlock(f: RepoFacts) {
  return [
    "<repository_facts source=\"static index, not AI\">",
    `name: ${f.repo.name}${f.repo.commit ? ` @ ${f.repo.commit}` : ""}; files indexed: ${f.repo.files}; lines: ${f.repo.lines}; symbols: ${f.repo.symbols}; files skipped at import: ${f.repo.skipped}`,
    `frameworks (from manifests): ${f.repo.frameworks.join(", ") || "none detected"}; ecosystems: ${f.repo.ecosystems.join(", ") || "none"}`,
    `languages by lines: ${f.languages.map(([l, n]) => `${l} ${n}`).join(", ")}`,
    `largest modules: ${f.modules.map((m) => `${m.path} (${m.files} files)`).join(", ")}`,
    `most depended-on files: ${f.hubs.map((h) => `${h.path} (${h.importers} importers)`).join(", ") || "none"}`,
    `entry points: ${f.entries.map((e) => `${e.path}${e.line ? `:${e.line}` : ""} [${e.why}]`).join("; ") || "none detected"}`,
    f.routes.length ? `route/page files: ${f.routes.map((r) => r.path).join(", ")}` : "",
    "</repository_facts>",
  ]
    .filter(Boolean)
    .join("\n");
}
