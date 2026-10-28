import { NextResponse } from "next/server";
import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { describeExit, RUN_LANGUAGES } from "@/lib/runner/languages";
import { RUN_LIMITS, runProgram, RunnerUnavailableError } from "@/lib/runner/run";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 120;

const Body = z.object({
  language: z.enum(RUN_LANGUAGES as [string, ...string[]]),
  code: z.string().min(1).max(RUN_LIMITS.codeChars),
  stdin: z.string().max(RUN_LIMITS.stdinChars).default(""),
});

/** Runs a small program in an isolated Vercel Sandbox and stores the real result for the tutor. */
export const POST = withUser(async (req, { user }) => {
  const body = parseBody(Body, await readJson(req));
  await enforceRateLimit("run", user.id);
  let result;
  try {
    result = await runProgram(body.language as never, body.code, body.stdin);
  } catch (error) {
    if (error instanceof RunnerUnavailableError) throw new ApiError(503, "provider_not_configured", error.message);
    throw new ApiError(502, "upstream_error", "The code runner couldn't start a sandbox. Please try again.");
  }
  const db = await getDb();
  const [row] = await db.insert(schema.codeRun).values({ ownerId: user.id, code: body.code, stdin: body.stdin, ...result }).returning({ id: schema.codeRun.id, createdAt: schema.codeRun.createdAt });
  return NextResponse.json({ id: row.id, ...result, exitExplanation: describeExit(result.exitCode, result.timedOut) });
});

export const GET = withUser(async (_req, { user }) => {
  const db = await getDb();
  const runs = await db
    .select({ id: schema.codeRun.id, language: schema.codeRun.language, exitCode: schema.codeRun.exitCode, phase: schema.codeRun.phase, timedOut: schema.codeRun.timedOut, createdAt: schema.codeRun.createdAt, code: schema.codeRun.code })
    .from(schema.codeRun)
    .where(eq(schema.codeRun.ownerId, user.id))
    .orderBy(desc(schema.codeRun.createdAt))
    .limit(30);
  return NextResponse.json({ runs: runs.map((r) => ({ ...r, preview: r.code.split("\n").find((l) => l.trim())?.slice(0, 80) ?? "", code: undefined })) });
});
