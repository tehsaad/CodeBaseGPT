import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { describeExit } from "@/lib/runner/languages";
import { ApiError, withUser } from "@/lib/security/api";

export const GET = withUser<{ runId: string }>(async (_req, { user, params }) => {
  if (!z.uuid().safeParse(params.runId).success) throw new ApiError(404, "not_found", "Run not found");
  const db = await getDb();
  const [run] = await db.select().from(schema.codeRun).where(and(eq(schema.codeRun.id, params.runId), eq(schema.codeRun.ownerId, user.id)));
  if (!run) throw new ApiError(404, "not_found", "Run not found");
  return NextResponse.json({ ...run, exitExplanation: describeExit(run.exitCode, run.timedOut) });
});
