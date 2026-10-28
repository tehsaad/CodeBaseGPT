import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { requireOwnedRepository } from "@/lib/security/access";
import { withUser } from "@/lib/security/api";

type P = { id: string };

export const GET = withUser<P>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const db = await getDb();
  const [job] = await db.select().from(schema.indexingJob).where(eq(schema.indexingJob.repositoryId, repo.id)).orderBy(desc(schema.indexingJob.createdAt)).limit(1);
  return NextResponse.json({ repository: repo, job: job ?? null });
});

export const DELETE = withUser<P>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const db = await getDb();
  await db.delete(schema.repository).where(eq(schema.repository.id, repo.id));
  return new NextResponse(null, { status: 204 });
});
