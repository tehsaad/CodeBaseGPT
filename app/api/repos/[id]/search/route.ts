import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "@/lib/db";
import { requireOwnedRepository } from "@/lib/security/access";
import { withUser } from "@/lib/security/api";

/** Fuzzy search over file paths and symbol names (trigram similarity), for the Atlas and command palette. */
export const GET = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const q = (new URL(req.url).searchParams.get("q") ?? "").trim().slice(0, 100);
  if (q.length < 2) return NextResponse.json({ results: [] });
  const like = `%${q.replace(/[%_\\]/g, "\\$&")}%`;
  const db = await getDb();
  const rows = rowsOf<{ type: string; id: string; file_id: string; name: string; path: string; kind: string | null; start_line: number | null; score: number }>(
    await db.execute(sql`
      (select 'symbol' as type, s.id, s.file_id, s.name, f.path, s.kind, s.start_line,
              greatest(similarity(s.name, ${q}), case when s.name ilike ${like} then 0.6 else 0 end) as score
         from code_symbol s join repo_file f on f.id = s.file_id
        where s.repository_id = ${repo.id} and (s.name ilike ${like} or similarity(s.name, ${q}) > 0.3)
        order by score desc limit 15)
      union all
      (select 'file' as type, f.id, f.id as file_id, f.path as name, f.path, f.language as kind, null as start_line,
              greatest(similarity(f.path, ${q}), case when f.path ilike ${like} then 0.5 else 0 end) as score
         from repo_file f
        where f.repository_id = ${repo.id} and (f.path ilike ${like} or similarity(f.path, ${q}) > 0.25)
        order by score desc limit 15)`),
  );
  rows.sort((a, b) => Number(b.score) - Number(a.score));
  return NextResponse.json({
    results: rows.slice(0, 20).map((r) => ({ type: r.type, id: r.id, fileId: r.file_id, name: r.name, path: r.path, kind: r.kind, startLine: r.start_line })),
  });
});
