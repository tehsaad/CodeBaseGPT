import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requireReady } from "@/lib/repos/guards";
import { buildLearningPath } from "@/lib/repos/learning";
import { requireOwnedRepository } from "@/lib/security/access";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";

export const GET = withUser<{ id: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  requireReady(repo);
  const db = await getDb();
  const [stages, done] = await Promise.all([
    buildLearningPath(repo),
    db.select({ taskId: schema.learningProgress.taskId }).from(schema.learningProgress).where(and(eq(schema.learningProgress.ownerId, user.id), eq(schema.learningProgress.repositoryId, repo.id))),
  ]);
  return NextResponse.json({ stages, completed: done.map((d) => d.taskId) });
});

const Body = z.object({ taskId: z.string().min(1).max(600), done: z.boolean() });

export const POST = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const body = parseBody(Body, await readJson(req));
  const valid = (await buildLearningPath(repo)).some((s) => s.tasks.some((t) => t.id === body.taskId));
  if (!valid) throw new ApiError(404, "not_found", "That task isn't part of this repository's learning path");
  const db = await getDb();
  const p = schema.learningProgress;
  if (body.done) await db.insert(p).values({ ownerId: user.id, repositoryId: repo.id, taskId: body.taskId }).onConflictDoNothing();
  else await db.delete(p).where(and(eq(p.ownerId, user.id), eq(p.repositoryId, repo.id), eq(p.taskId, body.taskId)));
  return NextResponse.json({ ok: true });
});
