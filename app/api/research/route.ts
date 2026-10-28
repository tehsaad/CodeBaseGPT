import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { runWebResearch } from "@/lib/ai/stuck";
import { getDb, schema } from "@/lib/db";
import { requireOwnedRepository } from "@/lib/security/access";
import { parseBody, readJson, withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

const Body = z.object({ query: z.string().trim().min(3).max(300), repositoryId: z.uuid() });

/** "Search the web": runs one real search and returns results (no model call). */
export const POST = withUser(async (req, { user }) => {
  const body = parseBody(Body, await readJson(req));
  const repo = await requireOwnedRepository(user.id, body.repositoryId);
  await enforceRateLimit("search", user.id);
  const { part } = await runWebResearch({ ownerId: user.id, repoId: repo.id, conversationId: null, queries: [body.query] });
  return NextResponse.json(part);
});

export const GET = withUser(async (req, { user }) => {
  const url = new URL(req.url);
  const saved = url.searchParams.get("saved") === "1";
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50) || 50);
  const db = await getDb();
  const rows = await db
    .select({ result: schema.webResult, repoName: schema.repository.fullName })
    .from(schema.webResult)
    .leftJoin(schema.repository, eq(schema.repository.id, schema.webResult.repositoryId))
    .where(and(eq(schema.webResult.ownerId, user.id), saved ? eq(schema.webResult.saved, true) : undefined))
    .orderBy(desc(schema.webResult.createdAt))
    .limit(limit);
  return NextResponse.json({ results: rows.map((r) => ({ ...r.result, repositoryName: r.repoName })) });
});
