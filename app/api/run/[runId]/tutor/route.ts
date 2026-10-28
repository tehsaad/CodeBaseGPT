import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { streamTutor } from "@/lib/ai/tutor";
import { getDb, schema } from "@/lib/db";
import type { RunLanguage } from "@/lib/runner/languages";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 180;

const Body = z.object({ level: z.enum(["beginner", "intermediate", "advanced"]).default("beginner"), question: z.string().max(2000).optional() });

/** Explains a stored run. The tutor reads the recorded sandbox output, not text sent by the client. */
export const POST = withUser<{ runId: string }>(async (req, { user, params }) => {
  if (!z.uuid().safeParse(params.runId).success) throw new ApiError(404, "not_found", "Run not found");
  const body = parseBody(Body, await readJson(req));
  await enforceRateLimit("tutor", user.id);
  const db = await getDb();
  const [run] = await db.select().from(schema.codeRun).where(and(eq(schema.codeRun.id, params.runId), eq(schema.codeRun.ownerId, user.id)));
  if (!run) throw new ApiError(404, "not_found", "Run not found");
  return streamTutor({ run: { ...run, language: run.language as RunLanguage }, level: body.level, question: body.question });
});
