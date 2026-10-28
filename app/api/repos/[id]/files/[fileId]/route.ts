import { NextResponse } from "next/server";
import { and, asc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireOwnedRepository } from "@/lib/security/access";
import { ApiError, withUser } from "@/lib/security/api";

const { repoFile, codeSymbol, fileImport } = schema;

export const GET = withUser<{ id: string; fileId: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  if (!z.uuid().safeParse(params.fileId).success) throw new ApiError(404, "not_found", "File not found");
  const db = await getDb();
  const [file] = await db.select().from(repoFile).where(and(eq(repoFile.id, params.fileId), eq(repoFile.repositoryId, repo.id)));
  if (!file) throw new ApiError(404, "not_found", "File not found");

  const [symbols, imports, dependents] = await Promise.all([
    db.select().from(codeSymbol).where(eq(codeSymbol.fileId, file.id)).orderBy(asc(codeSymbol.startLine)),
    db
      .select({ specifier: fileImport.specifier, line: fileImport.line, kind: fileImport.kind, names: fileImport.names, targetFileId: fileImport.targetFileId, targetPath: repoFile.path })
      .from(fileImport)
      .leftJoin(repoFile, eq(repoFile.id, fileImport.targetFileId))
      .where(eq(fileImport.fileId, file.id))
      .orderBy(asc(fileImport.line)),
    db
      .select({ fileId: fileImport.fileId, line: fileImport.line, path: repoFile.path })
      .from(fileImport)
      .innerJoin(repoFile, eq(repoFile.id, fileImport.fileId))
      .where(and(eq(fileImport.repositoryId, repo.id), eq(fileImport.targetFileId, file.id)))
      .orderBy(asc(repoFile.path))
      .limit(200),
  ]);
  return NextResponse.json({
    file: { id: file.id, path: file.path, language: file.language, lines: file.lineCount, sizeBytes: file.sizeBytes, parseStatus: file.parseStatus, parseError: file.parseError, content: file.content },
    symbols,
    imports,
    dependents,
    repository: { id: repo.id, fullName: repo.fullName, htmlUrl: repo.htmlUrl, commitSha: repo.commitSha },
  });
});
