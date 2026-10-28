import "server-only";
import { and, asc, eq, inArray } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";

const { codeSymbol, symbolCall, repoFile, fileImport } = schema;

export type Derivation = "same-file" | "via-import" | "unresolved";

/**
 * Call relationships for one symbol, with the call-site line and how each was derived:
 * - same-file: callee defined in the same file (statically extracted)
 * - via-import: callee name matched a symbol in a file this file imports (static, name-based)
 * - unresolved: only the callee name is known (dynamic dispatch, library, or ambiguous)
 */
export async function symbolRelations(repoId: string, symbolId: string) {
  const db = await getDb();
  const [sym] = await db.select().from(codeSymbol).where(and(eq(codeSymbol.id, symbolId), eq(codeSymbol.repositoryId, repoId)));
  if (!sym) return null;
  const [file] = await db.select({ id: repoFile.id, path: repoFile.path }).from(repoFile).where(eq(repoFile.id, sym.fileId));

  const outgoingRaw = await db
    .select({ line: symbolCall.line, calleeName: symbolCall.calleeName, calleeId: symbolCall.calleeSymbolId })
    .from(symbolCall)
    .where(eq(symbolCall.callerSymbolId, sym.id))
    .orderBy(asc(symbolCall.line))
    .limit(200);
  const calleeIds = [...new Set(outgoingRaw.map((c) => c.calleeId).filter((x): x is string => Boolean(x)))];
  const callees = calleeIds.length
    ? await db.select({ id: codeSymbol.id, name: codeSymbol.name, kind: codeSymbol.kind, fileId: codeSymbol.fileId, startLine: codeSymbol.startLine, path: repoFile.path }).from(codeSymbol).innerJoin(repoFile, eq(repoFile.id, codeSymbol.fileId)).where(inArray(codeSymbol.id, calleeIds))
    : [];
  const calleeById = new Map(callees.map((c) => [c.id, c]));

  const incomingRaw = await db
    .select({ line: symbolCall.line, callerId: symbolCall.callerSymbolId, fileId: symbolCall.fileId, path: repoFile.path })
    .from(symbolCall)
    .innerJoin(repoFile, eq(repoFile.id, symbolCall.fileId))
    .where(eq(symbolCall.calleeSymbolId, sym.id))
    .orderBy(asc(repoFile.path), asc(symbolCall.line))
    .limit(200);
  const callerIds = [...new Set(incomingRaw.map((c) => c.callerId).filter((x): x is string => Boolean(x)))];
  const callers = callerIds.length ? await db.select({ id: codeSymbol.id, name: codeSymbol.name, kind: codeSymbol.kind }).from(codeSymbol).where(inArray(codeSymbol.id, callerIds)) : [];
  const callerById = new Map(callers.map((c) => [c.id, c]));

  const derive = (calleeFileId: string | null | undefined): Derivation => (!calleeFileId ? "unresolved" : calleeFileId === sym.fileId ? "same-file" : "via-import");

  return {
    symbol: { id: sym.id, name: sym.name, kind: sym.kind, parentName: sym.parentName, startLine: sym.startLine, endLine: sym.endLine, fileId: sym.fileId, path: file.path, complexity: sym.complexity },
    calls: outgoingRaw.map((c) => {
      const t = c.calleeId ? calleeById.get(c.calleeId) : undefined;
      return { line: c.line, name: c.calleeName, derivation: derive(t?.fileId), target: t ? { id: t.id, name: t.name, kind: t.kind, fileId: t.fileId, path: t.path, startLine: t.startLine } : null };
    }),
    calledBy: incomingRaw.map((c) => {
      const caller = c.callerId ? callerById.get(c.callerId) : undefined;
      return { line: c.line, fileId: c.fileId, path: c.path, caller: caller ? { id: caller.id, name: caller.name, kind: caller.kind } : null, derivation: (c.fileId === sym.fileId ? "same-file" : "via-import") as Derivation };
    }),
  };
}

/** Import statements between two files (or into a folder), with their line numbers. */
export async function importEvidence(repoId: string, fileId: string) {
  const db = await getDb();
  const [outgoing, incoming] = await Promise.all([
    db.select({ line: fileImport.line, specifier: fileImport.specifier, kind: fileImport.kind, targetPath: repoFile.path, targetFileId: fileImport.targetFileId }).from(fileImport).leftJoin(repoFile, eq(repoFile.id, fileImport.targetFileId)).where(and(eq(fileImport.repositoryId, repoId), eq(fileImport.fileId, fileId))).orderBy(asc(fileImport.line)),
    db.select({ line: fileImport.line, specifier: fileImport.specifier, path: repoFile.path, fileId: fileImport.fileId }).from(fileImport).innerJoin(repoFile, eq(repoFile.id, fileImport.fileId)).where(and(eq(fileImport.repositoryId, repoId), eq(fileImport.targetFileId, fileId))).orderBy(asc(repoFile.path)),
  ]);
  return { outgoing, incoming };
}
