import { NextResponse } from "next/server";
import { runInBackground } from "@/lib/background";
import { and, desc, eq, lt } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { runJobToCompletion } from "@/lib/ingest/indexer";
import { importFromGitHub, importFromZip } from "@/lib/repos/import";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 300;

export const GET = withUser(async (req, { user }) => {
  const url = new URL(req.url);
  const limit = Math.min(50, Math.max(1, Number(url.searchParams.get("limit") ?? 20) || 20));
  const cursor = url.searchParams.get("cursor");
  const db = await getDb();
  const rows = await db
    .select()
    .from(schema.repository)
    .where(and(eq(schema.repository.ownerId, user.id), cursor ? lt(schema.repository.createdAt, new Date(cursor)) : undefined))
    .orderBy(desc(schema.repository.createdAt))
    .limit(limit + 1);
  const page = rows.slice(0, limit);
  return NextResponse.json({ repositories: page, nextCursor: rows.length > limit ? page[page.length - 1].createdAt.toISOString() : null });
});

const GitHubBody = z.object({ source: z.literal("github"), url: z.string().min(3).max(300) });

export const POST = withUser(async (req, { user }) => {
  await enforceRateLimit("import", user.id);
  const type = req.headers.get("content-type") ?? "";
  let result;
  if (type.startsWith("multipart/form-data")) {
    const form = await req.formData().catch(() => {
      throw new ApiError(400, "invalid_request", "Upload could not be read");
    });
    const file = form.get("file");
    if (!(file instanceof File)) throw new ApiError(400, "invalid_request", "Attach a .zip file");
    if (!/\.zip$/i.test(file.name)) throw new ApiError(400, "invalid_request", "Only .zip archives are supported");
    result = await importFromZip(user.id, file);
  } else {
    const body = parseBody(GitHubBody, await readJson(req));
    result = await importFromGitHub(user.id, body.url, req.headers);
  }
  const job = result.job;
  if (job) runInBackground(() => runJobToCompletion(job.id, user.id, 250_000));
  return NextResponse.json({ repository: result.repo, job, existing: result.existing, skipped: "skipped" in result ? result.skipped : undefined }, { status: result.existing ? 200 : 201 });
});
