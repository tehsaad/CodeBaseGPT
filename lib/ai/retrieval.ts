import "server-only";
import { and, eq, inArray, isNotNull, or, sql } from "drizzle-orm";
import { getDb, rowsOf, schema } from "@/lib/db";
import { embeddingStatus } from "@/lib/env";
import { log } from "@/lib/observability/log";
import { embedTexts } from "./embeddings";

const { codeChunk, repoFile, codeSymbol, fileImport, symbolCall } = schema;

export type EvidenceReason = "focus" | "lexical" | "semantic" | "call-site" | "dependent" | "definition";

export type Evidence = {
  label: string;
  fileId: string;
  path: string;
  language: string | null;
  startLine: number;
  endLine: number;
  content: string;
  symbol: string | null;
  reason: EvidenceReason;
};

export type Focus = { fileId?: string; symbolId?: string; startLine?: number; endLine?: number };

const STOPWORDS = new Set(
  "a an and are as at be but by can could do does for from has have how i if in into is it its me my of on or our should so that the their them then there these this those to was we what when where which who why will with would you your file code project repo repository function method class module explain work works use used using does doing called call".split(" "),
);

/** Turns a natural-language question into safe tsquery prefix terms (only [a-z0-9_]). */
export function queryTerms(question: string): string[] {
  const words = question.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const terms = new Set<string>();
  for (const w of words) {
    const lower = w.toLowerCase();
    if (lower.length >= 3 && !STOPWORDS.has(lower)) terms.add(lower);
    const parts = w.replace(/([a-z0-9])([A-Z])/g, "$1 $2").split(/[_\s]+/);
    if (parts.length > 1) for (const p of parts) if (p.length >= 3 && !STOPWORDS.has(p.toLowerCase())) terms.add(p.toLowerCase());
  }
  return [...terms].slice(0, 14);
}

/** Identifiers the user typed that look like code (camelCase, snake_case, `name()`). */
export function mentionedIdentifiers(question: string): string[] {
  const out = new Set<string>();
  for (const m of question.matchAll(/`([A-Za-z_][\w.:]*)`|([A-Za-z_]\w*)\(\)|\b([a-z]+[A-Z]\w*|[A-Z][a-z]+[A-Z]\w*|[a-z]+_[a-z_]+)\b/g)) {
    const id = (m[1] ?? m[2] ?? m[3])?.split(/[.:]/).pop();
    if (id && id.length >= 3) out.add(id);
  }
  return [...out].slice(0, 6);
}

type Candidate = Omit<Evidence, "label"> & { score: number; chunkId?: string };

function lineSlice(content: string, start: number, end: number) {
  return content.split("\n").slice(start - 1, end).join("\n");
}

export type RetrieveOptions = { repoId: string; question: string; focus?: Focus; limit?: number; charBudget?: number };

export async function retrieve({ repoId, question, focus, limit = 10, charBudget = 22_000 }: RetrieveOptions): Promise<Evidence[]> {
  const db = await getDb();
  const candidates: Candidate[] = [];

  // 1. Focus from the Atlas / source viewer: the selected symbol or file section.
  let focusSymbolId = focus?.symbolId;
  let focusFileId = focus?.fileId;
  if (focusSymbolId) {
    const [s] = await db
      .select({ id: codeSymbol.id, fileId: codeSymbol.fileId, name: codeSymbol.name, startLine: codeSymbol.startLine, endLine: codeSymbol.endLine })
      .from(codeSymbol)
      .where(and(eq(codeSymbol.id, focusSymbolId), eq(codeSymbol.repositoryId, repoId)));
    if (s) {
      focusFileId = s.fileId;
      const [f] = await db.select().from(repoFile).where(eq(repoFile.id, s.fileId));
      const end = Math.min(s.endLine, s.startLine + 150);
      candidates.push({ fileId: f.id, path: f.path, language: f.language, startLine: s.startLine, endLine: end, content: lineSlice(f.content, s.startLine, end), symbol: s.name, reason: "focus", score: 100 });
    } else {
      focusSymbolId = undefined;
    }
  } else if (focusFileId) {
    const [f] = await db.select().from(repoFile).where(and(eq(repoFile.id, focusFileId), eq(repoFile.repositoryId, repoId)));
    if (f) {
      const start = Math.max(1, focus?.startLine ?? 1);
      const end = Math.min(f.lineCount || 1, focus?.endLine ?? start + 119);
      candidates.push({ fileId: f.id, path: f.path, language: f.language, startLine: start, endLine: end, content: lineSlice(f.content, start, end), symbol: null, reason: "focus", score: 100 });
    } else {
      focusFileId = undefined;
    }
  }

  // 2. Lexical retrieval over structure-aware chunks.
  const terms = queryTerms(question);
  if (terms.length) {
    const tsquery = terms.map((t) => `${t}:*`).join(" | ");
    const rows = rowsOf<{ id: string; file_id: string; path: string; language: string | null; start_line: number; end_line: number; content: string; symbol: string | null; rank: number }>(
      await db.execute(sql`
        select c.id, c.file_id, f.path, f.language, c.start_line, c.end_line, c.content, s.name as symbol,
               ts_rank_cd(c.tsv, q) as rank
          from code_chunk c
          join repo_file f on f.id = c.file_id
          left join code_symbol s on s.id = c.symbol_id
          cross join to_tsquery('simple', ${tsquery}) q
         where c.repository_id = ${repoId} and c.tsv @@ q
         order by rank desc
         limit 40`),
    );
    for (const r of rows) {
      const pathLower = r.path.toLowerCase();
      const symLower = r.symbol?.toLowerCase() ?? "";
      let score = Number(r.rank) * 10;
      for (const t of terms) {
        if (pathLower.includes(t)) score += 1.5;
        if (symLower && symLower.includes(t)) score += 2;
      }
      if (/\.(md|txt|json|ya?ml|toml)$/i.test(r.path)) score *= 0.6;
      if (/(^|\/)(test|tests|__tests__|spec)\/|\.(test|spec)\./i.test(r.path)) score *= 0.75;
      candidates.push({ chunkId: r.id, fileId: r.file_id, path: r.path, language: r.language, startLine: r.start_line, endLine: r.end_line, content: r.content, symbol: r.symbol, reason: "lexical", score });
    }
  }

  // 3. Semantic retrieval, when embeddings are configured and present.
  if (embeddingStatus().configured) {
    try {
      const [{ n }] = await db.select({ n: sql<number>`count(*)::int` }).from(codeChunk).where(and(eq(codeChunk.repositoryId, repoId), isNotNull(codeChunk.embedding)));
      if (n > 0) {
        const [vec] = await embedTexts([question], "query");
        const literal = `[${vec.join(",")}]`;
        const rows = rowsOf<{ id: string; file_id: string; path: string; language: string | null; start_line: number; end_line: number; content: string; symbol: string | null; distance: number }>(
          await db.execute(sql`
            select c.id, c.file_id, f.path, f.language, c.start_line, c.end_line, c.content, s.name as symbol,
                   c.embedding <=> ${literal}::vector as distance
              from code_chunk c join repo_file f on f.id = c.file_id left join code_symbol s on s.id = c.symbol_id
             where c.repository_id = ${repoId} and c.embedding is not null
             order by distance asc limit 20`),
        );
        rows.forEach((r, i) => {
          const existing = candidates.find((c) => c.chunkId === r.id);
          const rrf = 6 / (10 + i);
          if (existing) existing.score += rrf;
          else candidates.push({ chunkId: r.id, fileId: r.file_id, path: r.path, language: r.language, startLine: r.start_line, endLine: r.end_line, content: r.content, symbol: r.symbol, reason: "semantic", score: rrf });
        });
      }
    } catch (error) {
      log("warn", "retrieval.semantic_failed", { error });
    }
  }

  // 4. Symbols the user named explicitly: definitions + call sites (static analysis facts).
  const named = mentionedIdentifiers(question);
  const targetSymbols = named.length
    ? await db
        .select({ id: codeSymbol.id, name: codeSymbol.name, fileId: codeSymbol.fileId, startLine: codeSymbol.startLine, endLine: codeSymbol.endLine })
        .from(codeSymbol)
        .where(and(eq(codeSymbol.repositoryId, repoId), inArray(codeSymbol.name, named)))
        .limit(6)
    : [];
  if (focusSymbolId) {
    const [s] = await db.select({ id: codeSymbol.id, name: codeSymbol.name, fileId: codeSymbol.fileId, startLine: codeSymbol.startLine, endLine: codeSymbol.endLine }).from(codeSymbol).where(eq(codeSymbol.id, focusSymbolId));
    if (s) targetSymbols.push(s);
  }
  const fileCache = new Map<string, { path: string; content: string; language: string | null }>();
  const loadFiles = async (ids: string[]) => {
    const missing = [...new Set(ids)].filter((id) => !fileCache.has(id));
    if (!missing.length) return;
    const rows = await db.select({ id: repoFile.id, path: repoFile.path, content: repoFile.content, language: repoFile.language }).from(repoFile).where(inArray(repoFile.id, missing));
    for (const r of rows) fileCache.set(r.id, r);
  };

  if (targetSymbols.length) {
    const ids = targetSymbols.map((s) => s.id);
    const names = targetSymbols.map((s) => s.name);
    const calls = await db
      .select({ fileId: symbolCall.fileId, line: symbolCall.line, callee: symbolCall.calleeName, resolved: symbolCall.calleeSymbolId })
      .from(symbolCall)
      .where(and(eq(symbolCall.repositoryId, repoId), or(inArray(symbolCall.calleeSymbolId, ids), inArray(symbolCall.calleeName, names))))
      .limit(12);
    await loadFiles([...calls.map((c) => c.fileId), ...targetSymbols.map((s) => s.fileId)]);
    for (const s of targetSymbols) {
      if (candidates.some((c) => c.fileId === s.fileId && c.startLine <= s.startLine && c.endLine >= s.startLine)) continue;
      const f = fileCache.get(s.fileId)!;
      const end = Math.min(s.endLine, s.startLine + 80);
      candidates.push({ fileId: s.fileId, path: f.path, language: f.language, startLine: s.startLine, endLine: end, content: lineSlice(f.content, s.startLine, end), symbol: s.name, reason: "definition", score: 50 });
    }
    for (const c of calls) {
      const f = fileCache.get(c.fileId)!;
      const start = Math.max(1, c.line - 2);
      const end = c.line + 2;
      candidates.push({ fileId: c.fileId, path: f.path, language: f.language, startLine: start, endLine: end, content: lineSlice(f.content, start, end), symbol: c.callee, reason: "call-site", score: c.resolved ? 40 : 30 });
    }
  }

  // 5. Files that import the focused file (who could break if it changes).
  if (focusFileId) {
    const deps = await db
      .select({ fileId: fileImport.fileId, line: fileImport.line })
      .from(fileImport)
      .where(and(eq(fileImport.repositoryId, repoId), eq(fileImport.targetFileId, focusFileId)))
      .limit(8);
    await loadFiles(deps.map((d) => d.fileId));
    for (const d of deps) {
      const f = fileCache.get(d.fileId)!;
      candidates.push({ fileId: d.fileId, path: f.path, language: f.language, startLine: d.line, endLine: d.line, content: lineSlice(f.content, d.line, d.line), symbol: null, reason: "dependent", score: 35 });
    }
  }

  // Merge overlapping ranges in the same file (keep the higher-scoring one) and apply the budget.
  candidates.sort((a, b) => b.score - a.score);
  const picked: Candidate[] = [];
  let chars = 0;
  for (const c of candidates) {
    if (picked.length >= limit) break;
    const overlaps = picked.some((p) => p.fileId === c.fileId && c.startLine <= p.endLine && c.endLine >= p.startLine);
    if (overlaps) continue;
    const size = c.content.length + c.path.length + 40;
    if (chars + size > charBudget) continue;
    chars += size;
    picked.push(c);
  }
  return picked.map((c, i) => ({
    label: `C${i + 1}`,
    fileId: c.fileId,
    path: c.path,
    language: c.language,
    startLine: c.startLine,
    endLine: c.endLine,
    content: c.content,
    symbol: c.symbol,
    reason: c.reason,
  }));
}
