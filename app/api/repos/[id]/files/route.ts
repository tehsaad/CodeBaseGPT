import { NextResponse } from "next/server";
import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireOwnedRepository } from "@/lib/security/access";
import { withUser } from "@/lib/security/api";

/** File tree metadata (no contents). Bounded by the indexer's 3,000-file cap. */
export const GET = withUser<{ id: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const db = await getDb();
  const files = await db
    .select({ id: schema.repoFile.id, path: schema.repoFile.path, language: schema.repoFile.language, lines: schema.repoFile.lineCount, parseStatus: schema.repoFile.parseStatus })
    .from(schema.repoFile)
    .where(eq(schema.repoFile.repositoryId, repo.id))
    .orderBy(asc(schema.repoFile.path));
  return NextResponse.json({ files });
});
