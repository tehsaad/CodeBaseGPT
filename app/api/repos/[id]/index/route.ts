import { NextResponse } from "next/server";
import { runInBackground } from "@/lib/background";
import { and, desc, eq, inArray } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { requeueParse, runJobStep, runJobToCompletion } from "@/lib/ingest/indexer";
import { reindexGitHub } from "@/lib/repos/import";
import { requireOwnedRepository } from "@/lib/security/access";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 300;

const Body = z.object({ action: z.enum(["step", "cancel", "reindex"]) });

/** step: advance the active job (client-driven fallback, resumable) · cancel · reindex. */
export const POST = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const { action } = parseBody(Body, await readJson(req));
  const db = await getDb();
  const [active] = await db
    .select()
    .from(schema.indexingJob)
    .where(and(eq(schema.indexingJob.repositoryId, repo.id), inArray(schema.indexingJob.status, ["queued", "running"])))
    .orderBy(desc(schema.indexingJob.createdAt))
    .limit(1);

  if (action === "step") {
    await enforceRateLimit("indexStep", user.id);
    if (!active) return NextResponse.json({ job: null, repository: repo });
    const { job } = await runJobStep(active.id, user.id, 15_000);
    const [fresh] = await db.select().from(schema.repository).where(eq(schema.repository.id, repo.id));
    return NextResponse.json({ job, repository: fresh });
  }

  if (action === "cancel") {
    if (!active) throw new ApiError(409, "conflict", "No indexing job is running");
    await db.update(schema.indexingJob).set({ cancelRequested: true }).where(eq(schema.indexingJob.id, active.id));
    if (!active.leaseUntil || active.leaseUntil < new Date()) await runJobStep(active.id, user.id, 1000);
    return NextResponse.json({ ok: true });
  }

  await enforceRateLimit("import", user.id);
  if (active && active.leaseUntil && active.leaseUntil > new Date()) {
    throw new ApiError(409, "conflict", "Indexing is already in progress for this repository");
  }
  const job = repo.source === "github" ? (await reindexGitHub(user.id, repo, req.headers)).job : await requeueParse(repo.id, user.id);
  runInBackground(() => runJobToCompletion(job.id, user.id, 250_000));
  return NextResponse.json({ job }, { status: 202 });
});
