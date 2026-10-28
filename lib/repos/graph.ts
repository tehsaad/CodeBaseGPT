import "server-only";
import { and, eq, inArray, isNotNull, sql } from "drizzle-orm";
import { getDb, rowsOf, schema } from "@/lib/db";

const { repoFile, fileImport, codeSymbol, symbolCall } = schema;

export const MAX_NODES = 400;

export type GraphNode = {
  id: string;
  kind: "directory" | "file" | "symbol" | "external";
  label: string;
  path: string;
  fileId?: string;
  symbolId?: string;
  symbolKind?: string;
  language?: string | null;
  lines?: number;
  files?: number;
  symbols?: number;
  startLine?: number;
  endLine?: number;
  inDegree: number;
  outDegree: number;
  expandable?: boolean;
  expanded?: boolean;
};

export type GraphEdge = { id: string; source: string; target: string; weight: number; kind: "import" | "call" };

export type Graph = {
  mode: "architecture" | "dependencies" | "symbols";
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  totalCandidates: number;
  languages: string[];
};

export type GraphQuery = {
  mode: "architecture" | "dependencies" | "symbols";
  expanded?: string[];
  dir?: string;
  language?: string;
  symbolKind?: string;
  fileId?: string;
  includeExternal?: boolean;
};

type FileRow = { id: string; path: string; language: string | null; lineCount: number; symbols: number };

async function loadFiles(repoId: string, dir?: string, language?: string): Promise<FileRow[]> {
  const db = await getDb();
  const rows = rowsOf<{ id: string; path: string; language: string | null; line_count: number; symbols: number }>(
    await db.execute(sql`
      select f.id, f.path, f.language, f.line_count, count(s.id)::int as symbols
        from repo_file f left join code_symbol s on s.file_id = f.id
       where f.repository_id = ${repoId}
         ${dir ? sql`and (f.path like ${`${dir.replace(/[%_\\]/g, "\\$&")}/%`})` : sql``}
         ${language ? sql`and f.language = ${language}` : sql``}
       group by f.id`),
  );
  return rows.map((r) => ({ id: r.id, path: r.path, language: r.language, lineCount: r.line_count, symbols: r.symbols }));
}

async function loadEdges(repoId: string) {
  const db = await getDb();
  return db
    .select({ source: fileImport.fileId, target: fileImport.targetFileId, n: sql<number>`count(*)::int` })
    .from(fileImport)
    .where(and(eq(fileImport.repositoryId, repoId), isNotNull(fileImport.targetFileId)))
    .groupBy(fileImport.fileId, fileImport.targetFileId);
}

async function repoLanguages(repoId: string) {
  const db = await getDb();
  const rows = await db.selectDistinct({ l: repoFile.language }).from(repoFile).where(eq(repoFile.repositoryId, repoId));
  return rows.map((r) => r.l).filter((l): l is string => Boolean(l)).sort();
}

function finalize(nodes: Map<string, GraphNode>, edges: Map<string, GraphEdge>) {
  for (const e of edges.values()) {
    const s = nodes.get(e.source);
    const t = nodes.get(e.target);
    if (s) s.outDegree += e.weight;
    if (t) t.inDegree += e.weight;
  }
}

/**
 * Architecture view: folders collapse their contents until expanded. Edges between hidden files are
 * aggregated onto their nearest visible ancestors, so the overview stays small for big repositories.
 */
async function architecture(repoId: string, q: GraphQuery): Promise<Graph> {
  const files = await loadFiles(repoId, undefined, q.language);
  const expanded = new Set(q.expanded ?? []);
  expanded.add("");
  const nodes = new Map<string, GraphNode>();

  const visibleFor = (path: string): string => {
    const parts = path.split("/");
    let prefix = "";
    for (let i = 0; i < parts.length - 1; i++) {
      const next = prefix ? `${prefix}/${parts[i]}` : parts[i];
      if (!expanded.has(prefix)) return `dir:${prefix}`;
      if (!expanded.has(next)) return `dir:${next}`;
      prefix = next;
    }
    return `file:${path}`;
  };

  const fileNodeId = new Map<string, string>();
  for (const f of files) {
    const id = visibleFor(f.path);
    fileNodeId.set(f.id, id);
    let node = nodes.get(id);
    if (!node) {
      if (id.startsWith("dir:")) {
        const p = id.slice(4);
        node = { id, kind: "directory", label: `${p.split("/").pop()}/`, path: p, files: 0, lines: 0, symbols: 0, inDegree: 0, outDegree: 0, expandable: true, expanded: false };
      } else {
        node = { id, kind: "file", label: f.path.split("/").pop()!, path: f.path, fileId: f.id, language: f.language, lines: f.lineCount, symbols: f.symbols, inDegree: 0, outDegree: 0 };
      }
      nodes.set(id, node);
    }
    if (node.kind === "directory") {
      node.files! += 1;
      node.lines! += f.lineCount;
      node.symbols! += f.symbols;
    }
  }

  const edges = new Map<string, GraphEdge>();
  for (const e of await loadEdges(repoId)) {
    const s = fileNodeId.get(e.source);
    const t = e.target ? fileNodeId.get(e.target) : undefined;
    if (!s || !t || s === t) continue;
    const key = `${s}->${t}`;
    const cur = edges.get(key);
    if (cur) cur.weight += e.n;
    else edges.set(key, { id: key, source: s, target: t, weight: e.n, kind: "import" });
  }
  finalize(nodes, edges);

  let list = [...nodes.values()];
  const truncated = list.length > MAX_NODES;
  if (truncated) {
    list = list.sort((a, b) => b.inDegree + b.outDegree - (a.inDegree + a.outDegree)).slice(0, MAX_NODES);
  }
  const keep = new Set(list.map((n) => n.id));
  return {
    mode: "architecture",
    nodes: list,
    edges: [...edges.values()].filter((e) => keep.has(e.source) && keep.has(e.target)),
    truncated,
    totalCandidates: nodes.size,
    languages: await repoLanguages(repoId),
  };
}

/** Flat file-to-file dependency graph, optionally scoped to a directory and language. */
async function dependencies(repoId: string, q: GraphQuery): Promise<Graph> {
  const files = await loadFiles(repoId, q.dir, q.language);
  const byId = new Map(files.map((f) => [f.id, f]));
  const raw = (await loadEdges(repoId)).filter((e) => byId.has(e.source) && e.target && byId.has(e.target) && e.source !== e.target);
  const degree = new Map<string, number>();
  for (const e of raw) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + e.n);
    degree.set(e.target!, (degree.get(e.target!) ?? 0) + e.n);
  }
  // Prefer connected files; isolated files are only shown for small scopes.
  const ranked = files
    .filter((f) => degree.has(f.id) || files.length <= 60)
    .sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0));
  const chosen = ranked.slice(0, MAX_NODES);
  const keep = new Set(chosen.map((f) => f.id));
  const nodes = new Map<string, GraphNode>(
    chosen.map((f) => [
      `file:${f.path}`,
      { id: `file:${f.path}`, kind: "file", label: f.path.split("/").pop()!, path: f.path, fileId: f.id, language: f.language, lines: f.lineCount, symbols: f.symbols, inDegree: 0, outDegree: 0 },
    ]),
  );
  const edges = new Map<string, GraphEdge>();
  for (const e of raw) {
    if (!keep.has(e.source) || !keep.has(e.target!)) continue;
    const s = `file:${byId.get(e.source)!.path}`;
    const t = `file:${byId.get(e.target!)!.path}`;
    edges.set(`${s}->${t}`, { id: `${s}->${t}`, source: s, target: t, weight: e.n, kind: "import" });
  }

  if (q.includeExternal) {
    const db = await getDb();
    const ext = await db
      .select({ fileId: fileImport.fileId, spec: fileImport.specifier })
      .from(fileImport)
      .where(and(eq(fileImport.repositoryId, repoId), eq(fileImport.kind, "external"), inArray(fileImport.fileId, [...keep])));
    for (const x of ext) {
      if (nodes.size >= MAX_NODES) break;
      const pkg = x.spec.replace(/^<|>$/g, "");
      const name = pkg.startsWith("@") ? pkg.split("/").slice(0, 2).join("/") : pkg.split("/")[0];
      const id = `ext:${name}`;
      if (!nodes.has(id)) nodes.set(id, { id, kind: "external", label: name, path: name, inDegree: 0, outDegree: 0 });
      const s = `file:${byId.get(x.fileId)!.path}`;
      const key = `${s}->${id}`;
      const cur = edges.get(key);
      if (cur) cur.weight++;
      else edges.set(key, { id: key, source: s, target: id, weight: 1, kind: "import" });
    }
  }
  finalize(nodes, edges);
  return { mode: "dependencies", nodes: [...nodes.values()], edges: [...edges.values()], truncated: ranked.length > MAX_NODES, totalCandidates: files.length, languages: await repoLanguages(repoId) };
}

/** Symbols and statically resolved call edges, scoped to a file or directory. */
async function symbols(repoId: string, q: GraphQuery): Promise<Graph> {
  const db = await getDb();
  const files = q.fileId
    ? (await loadFiles(repoId)).filter((f) => f.id === q.fileId)
    : await loadFiles(repoId, q.dir, q.language);
  const fileIds = files.map((f) => f.id);
  const pathById = new Map(files.map((f) => [f.id, f.path]));
  if (!fileIds.length) return { mode: "symbols", nodes: [], edges: [], truncated: false, totalCandidates: 0, languages: await repoLanguages(repoId) };

  const syms = await db
    .select()
    .from(codeSymbol)
    .where(and(eq(codeSymbol.repositoryId, repoId), inArray(codeSymbol.fileId, fileIds), q.symbolKind ? eq(codeSymbol.kind, q.symbolKind as never) : undefined))
    .limit(MAX_NODES * 3);
  const calls = syms.length
    ? await db
        .select({ caller: symbolCall.callerSymbolId, callee: symbolCall.calleeSymbolId, n: sql<number>`count(*)::int` })
        .from(symbolCall)
        .where(and(eq(symbolCall.repositoryId, repoId), isNotNull(symbolCall.callerSymbolId), isNotNull(symbolCall.calleeSymbolId), inArray(symbolCall.callerSymbolId, syms.map((s) => s.id))))
        .groupBy(symbolCall.callerSymbolId, symbolCall.calleeSymbolId)
    : [];

  const degree = new Map<string, number>();
  for (const c of calls) {
    degree.set(c.caller!, (degree.get(c.caller!) ?? 0) + c.n);
    degree.set(c.callee!, (degree.get(c.callee!) ?? 0) + c.n);
  }
  const chosen = [...syms].sort((a, b) => (degree.get(b.id) ?? 0) - (degree.get(a.id) ?? 0)).slice(0, MAX_NODES);

  // Callees outside the scope are shown so cross-file calls stay visible.
  const outside = calls.map((c) => c.callee!).filter((id) => !chosen.some((s) => s.id === id));
  const extra = outside.length
    ? await db.select().from(codeSymbol).where(inArray(codeSymbol.id, [...new Set(outside)].slice(0, Math.max(0, MAX_NODES - chosen.length))))
    : [];
  if (extra.length) {
    const extraFiles = await db.select({ id: repoFile.id, path: repoFile.path }).from(repoFile).where(inArray(repoFile.id, [...new Set(extra.map((s) => s.fileId))]));
    for (const f of extraFiles) pathById.set(f.id, f.path);
  }
  const all = [...chosen, ...extra];
  const nodes = new Map<string, GraphNode>(
    all.map((s) => [
      `sym:${s.id}`,
      {
        id: `sym:${s.id}`,
        kind: "symbol",
        label: s.parentName && s.kind === "method" ? `${s.parentName.split("::").pop()}.${s.name}` : s.name,
        path: pathById.get(s.fileId) ?? "",
        fileId: s.fileId,
        symbolId: s.id,
        symbolKind: s.kind,
        startLine: s.startLine,
        endLine: s.endLine,
        lines: s.endLine - s.startLine + 1,
        inDegree: 0,
        outDegree: 0,
      },
    ]),
  );
  const edges = new Map<string, GraphEdge>();
  for (const c of calls) {
    const s = `sym:${c.caller}`;
    const t = `sym:${c.callee}`;
    if (s === t || !nodes.has(s) || !nodes.has(t)) continue;
    edges.set(`${s}->${t}`, { id: `${s}->${t}`, source: s, target: t, weight: c.n, kind: "call" });
  }
  finalize(nodes, edges);
  return { mode: "symbols", nodes: [...nodes.values()], edges: [...edges.values()], truncated: syms.length > MAX_NODES, totalCandidates: syms.length, languages: await repoLanguages(repoId) };
}

export function buildGraph(repoId: string, q: GraphQuery) {
  if (q.mode === "dependencies") return dependencies(repoId, q);
  if (q.mode === "symbols") return symbols(repoId, q);
  return architecture(repoId, q);
}
