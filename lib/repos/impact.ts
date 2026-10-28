import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const { repoFile, fileImport, codeSymbol, symbolCall } = schema;

const TEST_PATH = /(^|\/)(tests?|__tests__|spec|specs|e2e)\/|[._-](test|spec)\.[a-z]+$|^test_[^/]*\.py$|\/test_[^/]*\.py$|_test\.(go|py)$|Test\.java$/i;
const ENTRY_PATH = /(^|\/)(app\/.*\/(route|page)\.[jt]sx?|pages\/api\/.+|routes?\/.+|controllers?\/.+|handlers?\/.+|views\.py|urls\.py|main\.(py|c|cpp|go|java|[jt]s)|index\.[jt]sx?|server\.[jt]s|app\.[jt]s|manage\.py|cli\.[jt]s|bin\/.+)$/i;
const DATA_PATH = /(^|\/)(db|database|models?|schema|migrations?|repositor(y|ies)|dao|prisma|drizzle|sql|store)(\/|\.|$)/i;
const DATA_PACKAGES = /^(pg|postgres|mysql2?|mongoose|mongodb|prisma|@prisma\/client|drizzle-orm|typeorm|sequelize|knex|sqlite3|better-sqlite3|redis|ioredis|sqlalchemy|psycopg2?|pymongo|django\.db|java\.sql|javax\.persistence|jakarta\.persistence)$/i;

export type ImpactFile = { fileId: string; path: string };
export type Evidence = "extracted" | "inferred";

const MAX_DEPTH = 6;
const MAX_TRANSITIVE = 400;

export async function computeImpact(repoId: string, target: { fileId?: string; symbolId?: string }) {
  const db = await getDb();
  let symbol: typeof codeSymbol.$inferSelect | undefined;
  let fileId = target.fileId;
  if (target.symbolId) {
    [symbol] = await db.select().from(codeSymbol).where(and(eq(codeSymbol.id, target.symbolId), eq(codeSymbol.repositoryId, repoId)));
    if (!symbol) return null;
    fileId = symbol.fileId;
  }
  if (!fileId) return null;

  const files = await db.select({ id: repoFile.id, path: repoFile.path }).from(repoFile).where(eq(repoFile.repositoryId, repoId));
  const pathOf = new Map(files.map((f) => [f.id, f.path]));
  if (!pathOf.has(fileId)) return null;

  const edges = await db
    .select({ from: fileImport.fileId, to: fileImport.targetFileId, line: fileImport.line })
    .from(fileImport)
    .where(and(eq(fileImport.repositoryId, repoId), isNotNull(fileImport.targetFileId)));
  const importersOf = new Map<string, { from: string; line: number }[]>();
  const importsOf = new Map<string, { to: string; line: number }[]>();
  for (const e of edges) {
    if (!e.to || e.to === e.from) continue;
    importersOf.set(e.to, [...(importersOf.get(e.to) ?? []), { from: e.from, line: e.line }]);
    importsOf.set(e.from, [...(importsOf.get(e.from) ?? []), { to: e.to, line: e.line }]);
  }

  // Breadth-first over reverse import edges: who (transitively) depends on the target file.
  const parent = new Map<string, { via: string; line: number }>();
  const depth = new Map<string, number>([[fileId, 0]]);
  const queue = [fileId];
  let capped = false;
  while (queue.length) {
    const cur = queue.shift()!;
    const d = depth.get(cur)!;
    if (d >= MAX_DEPTH) continue;
    for (const { from, line } of importersOf.get(cur) ?? []) {
      if (depth.has(from)) continue;
      if (depth.size > MAX_TRANSITIVE) {
        capped = true;
        break;
      }
      depth.set(from, d + 1);
      parent.set(from, { via: cur, line });
      queue.push(from);
    }
  }
  const pathTo = (id: string) => {
    const chain: { fileId: string; path: string; line: number | null }[] = [];
    let cur: string | undefined = id;
    while (cur) {
      const p = parent.get(cur);
      chain.push({ fileId: cur, path: pathOf.get(cur)!, line: p?.line ?? null });
      cur = p?.via;
    }
    return chain; // dependent → … → target
  };

  const dependents = [...depth.entries()].filter(([id, d]) => d > 0 && id !== fileId).map(([id, d]) => ({ fileId: id, path: pathOf.get(id)!, depth: d, path_: pathTo(id) }));
  const direct = (importersOf.get(fileId) ?? []).map((e) => ({ fileId: e.from, path: pathOf.get(e.from)!, line: e.line }));
  const dependencies = (importsOf.get(fileId) ?? []).map((e) => ({ fileId: e.to, path: pathOf.get(e.to)!, line: e.line }));

  const targetPath = pathOf.get(fileId)!;
  const base = targetPath.split("/").pop()!.replace(/\.[^.]+$/, "").toLowerCase();
  const testsByImport = dependents.filter((d) => TEST_PATH.test(d.path)).map((d) => ({ fileId: d.fileId, path: d.path, evidence: "extracted" as Evidence, chain: d.path_ }));
  const testsByName = files
    .filter((f) => f.id !== fileId && TEST_PATH.test(f.path) && !testsByImport.some((t) => t.fileId === f.id) && base.length >= 3 && f.path.toLowerCase().includes(base))
    .slice(0, 20)
    .map((f) => ({ fileId: f.id, path: f.path, evidence: "inferred" as Evidence, chain: [] as ReturnType<typeof pathTo> }));

  const entryPoints = dependents.filter((d) => ENTRY_PATH.test(d.path) && !TEST_PATH.test(d.path)).slice(0, 30).map((d) => ({ fileId: d.fileId, path: d.path, chain: d.path_ }));

  const externalImports = await db.select({ specifier: fileImport.specifier, fileId: fileImport.fileId, line: fileImport.line }).from(fileImport).where(and(eq(fileImport.repositoryId, repoId), eq(fileImport.kind, "external")));
  const nearby = new Set([fileId, ...dependencies.map((d) => d.fileId), ...direct.map((d) => d.fileId)]);
  const dataTouch = [
    ...[...nearby].filter((id) => DATA_PATH.test(pathOf.get(id)!)).map((id) => ({ fileId: id, path: pathOf.get(id)!, reason: "file path suggests data access", line: null as number | null })),
    ...externalImports.filter((x) => nearby.has(x.fileId) && DATA_PACKAGES.test(x.specifier.replace(/^<|>$/g, "").split("/").slice(0, x.specifier.startsWith("@") ? 2 : 1).join("/"))).map((x) => ({ fileId: x.fileId, path: pathOf.get(x.fileId)!, reason: `imports ${x.specifier}`, line: x.line })),
  ].slice(0, 20);

  const unresolvedHere = (await db.select({ id: fileImport.id }).from(fileImport).where(and(eq(fileImport.fileId, fileId), eq(fileImport.kind, "unresolved"))).limit(1)).length > 0;
  const unresolvedRepo = (await db.select({ id: fileImport.id }).from(fileImport).where(and(eq(fileImport.repositoryId, repoId), eq(fileImport.kind, "unresolved"))).limit(1000)).length;

  let calls = null;
  if (symbol) {
    const callers = await db
      .select({ line: symbolCall.line, fileId: symbolCall.fileId, path: repoFile.path, caller: codeSymbol.name })
      .from(symbolCall)
      .innerJoin(repoFile, eq(repoFile.id, symbolCall.fileId))
      .leftJoin(codeSymbol, eq(codeSymbol.id, symbolCall.callerSymbolId))
      .where(eq(symbolCall.calleeSymbolId, symbol.id))
      .limit(100);
    const nameOnly = await db
      .select({ line: symbolCall.line, fileId: symbolCall.fileId, path: repoFile.path })
      .from(symbolCall)
      .innerJoin(repoFile, eq(repoFile.id, symbolCall.fileId))
      .where(and(eq(symbolCall.repositoryId, repoId), eq(symbolCall.calleeName, symbol.name)))
      .limit(200);
    const resolvedKeys = new Set(callers.map((c) => `${c.fileId}:${c.line}`));
    calls = {
      callers: callers.map((c) => ({ ...c, evidence: "extracted" as Evidence })),
      sameNameUnresolved: nameOnly.filter((c) => !resolvedKeys.has(`${c.fileId}:${c.line}`)).slice(0, 30).map((c) => ({ ...c, evidence: "inferred" as Evidence })),
    };
  }

  const tests = [...testsByImport, ...testsByName];
  const steps = [
    tests.some((t) => t.evidence === "extracted") ? `Run the ${tests.filter((t) => t.evidence === "extracted").length} test file(s) that import this code (listed under Related tests).` : "No test file imports this code — add a focused test before changing it.",
    direct.length ? `Re-check the ${direct.length} file(s) that import it directly; each import line is listed.` : "Nothing imports this file directly; changes stay local unless it is loaded dynamically.",
    entryPoints.length ? `Exercise the ${entryPoints.length} entry point(s) that reach it (routes, pages, CLIs) and confirm their behaviour.` : null,
    dataTouch.length ? "It sits next to data-access code: verify reads/writes against a test database." : null,
    symbol && calls?.sameNameUnresolved.length ? `Review ${calls.sameNameUnresolved.length} call(s) to a function with the same name that static analysis couldn't tie to this definition.` : null,
  ].filter((x): x is string => Boolean(x));

  return {
    target: { fileId, path: targetPath, symbol: symbol ? { id: symbol.id, name: symbol.name, kind: symbol.kind, startLine: symbol.startLine, endLine: symbol.endLine } : null },
    dependencies,
    directDependents: direct,
    transitiveDependents: dependents.filter((d) => d.depth > 1).sort((a, b) => a.depth - b.depth || a.path.localeCompare(b.path)).map((d) => ({ fileId: d.fileId, path: d.path, depth: d.depth, chain: d.path_ })),
    tests,
    entryPoints,
    dataTouch,
    calls,
    steps,
    completeness: {
      maxDepth: MAX_DEPTH,
      capped,
      unresolvedImportsInFile: unresolvedHere,
      unresolvedImportsInRepo: unresolvedRepo,
      note: "Built from statically resolved imports and calls. Dynamic imports, reflection, dependency injection, string-based routing and code outside the index are not traced.",
    },
  };
}
