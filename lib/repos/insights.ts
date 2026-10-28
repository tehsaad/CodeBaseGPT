import "server-only";
import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "@/lib/db";

/** Strongly connected components (Tarjan) to report import cycles; deterministic and bounded. */
function findCycles(edges: { s: string; t: string }[], limit = 10) {
  const adj = new Map<string, string[]>();
  for (const e of edges) adj.set(e.s, [...(adj.get(e.s) ?? []), e.t]);
  let index = 0;
  const idx = new Map<string, number>();
  const low = new Map<string, number>();
  const onStack = new Set<string>();
  const stack: string[] = [];
  const out: string[][] = [];
  const strong = (v: string) => {
    idx.set(v, index);
    low.set(v, index++);
    stack.push(v);
    onStack.add(v);
    for (const w of adj.get(v) ?? []) {
      if (!idx.has(w)) {
        strong(w);
        low.set(v, Math.min(low.get(v)!, low.get(w)!));
      } else if (onStack.has(w)) low.set(v, Math.min(low.get(v)!, idx.get(w)!));
    }
    if (low.get(v) === idx.get(v)) {
      const comp: string[] = [];
      let w: string;
      do {
        w = stack.pop()!;
        onStack.delete(w);
        comp.push(w);
      } while (w !== v);
      if (comp.length > 1) out.push(comp);
    }
  };
  for (const v of adj.keys()) if (!idx.has(v)) strong(v);
  return out.sort((a, b) => b.length - a.length).slice(0, limit);
}

export async function computeInsights(repoId: string) {
  const db = await getDb();
  const q = async <T>(query: ReturnType<typeof sql>) => rowsOf<T>(await db.execute(query));

  const [languages, largest, symbolKinds, mostImported, mostImports, unresolved, complex, external, edges, parse] = await Promise.all([
    q<{ language: string | null; files: number; lines: number; bytes: number }>(sql`
      select language, count(*)::int as files, sum(line_count)::int as lines, sum(size_bytes)::int as bytes
        from repo_file where repository_id = ${repoId} group by language order by lines desc`),
    q<{ id: string; path: string; lines: number; bytes: number }>(sql`
      select id, path, line_count as lines, size_bytes as bytes from repo_file where repository_id = ${repoId} order by line_count desc limit 10`),
    q<{ kind: string; n: number }>(sql`select kind, count(*)::int as n from code_symbol where repository_id = ${repoId} group by kind order by n desc`),
    q<{ id: string; path: string; n: number }>(sql`
      select f.id, f.path, count(distinct i.file_id)::int as n from file_import i join repo_file f on f.id = i.target_file_id
       where i.repository_id = ${repoId} and i.file_id <> i.target_file_id group by f.id, f.path order by n desc limit 10`),
    q<{ id: string; path: string; n: number }>(sql`
      select f.id, f.path, count(distinct i.target_file_id)::int as n from file_import i join repo_file f on f.id = i.file_id
       where i.repository_id = ${repoId} and i.target_file_id is not null group by f.id, f.path order by n desc limit 10`),
    q<{ file_id: string; path: string; specifier: string; line: number }>(sql`
      select i.file_id, f.path, i.specifier, i.line from file_import i join repo_file f on f.id = i.file_id
       where i.repository_id = ${repoId} and i.kind = 'unresolved' order by f.path, i.line limit 50`),
    q<{ id: string; file_id: string; path: string; name: string; parent_name: string | null; complexity: number; start_line: number; end_line: number }>(sql`
      select s.id, s.file_id, f.path, s.name, s.parent_name, s.complexity, s.start_line, s.end_line from code_symbol s join repo_file f on f.id = s.file_id
       where s.repository_id = ${repoId} and s.kind in ('function','method') order by s.complexity desc, (s.end_line - s.start_line) desc limit 15`),
    q<{ name: string; n: number }>(sql`
      select case when specifier like '@%' then split_part(specifier, '/', 1) || '/' || split_part(specifier, '/', 2)
                  else split_part(trim(both '<>' from specifier), '/', 1) end as name, count(*)::int as n
        from file_import where repository_id = ${repoId} and kind = 'external' group by 1 order by n desc limit 15`),
    q<{ s: string; t: string }>(sql`
      select distinct file_id as s, target_file_id as t from file_import where repository_id = ${repoId} and target_file_id is not null and target_file_id <> file_id`),
    q<{ status: string; n: number }>(sql`select parse_status as status, count(*)::int as n from repo_file where repository_id = ${repoId} group by parse_status`),
  ]);

  const cycleIds = findCycles(edges);
  const ids = [...new Set(cycleIds.flat())];
  const paths = ids.length
    ? new Map(
        (await q<{ id: string; path: string }>(sql`select id, path from repo_file where id in (${sql.join(ids.map((i) => sql`${i}::uuid`), sql`, `)})`)).map((r) => [r.id, r.path]),
      )
    : new Map<string, string>();

  return {
    languages,
    largest,
    symbolKinds,
    mostImported,
    mostImports,
    unresolved,
    complex,
    external,
    cycles: cycleIds.map((c) => c.map((id) => ({ id, path: paths.get(id) ?? id }))),
    parse,
    complexityMethod:
      "Decision-point count (1 + if/elif/loops/case/catch/ternaries/&&/||/??), measured on the Tree-sitter syntax tree. A heuristic for where to read carefully, not a bug report.",
  };
}
