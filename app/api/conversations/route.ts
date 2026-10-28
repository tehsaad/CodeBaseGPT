import { NextResponse } from "next/server";
import { and, desc, eq, sql } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { withUser } from "@/lib/security/api";

export const GET = withUser(async (req, { user }) => {
  const url = new URL(req.url);
  const repoId = url.searchParams.get("repositoryId");
  const kind = url.searchParams.get("kind");
  const limit = Math.min(100, Number(url.searchParams.get("limit") ?? 50) || 50);
  const db = await getDb();
  const rows = await db
    .select({
      id: schema.conversation.id,
      title: schema.conversation.title,
      kind: schema.conversation.kind,
      repositoryId: schema.conversation.repositoryId,
      repositoryName: schema.repository.fullName,
      updatedAt: schema.conversation.updatedAt,
      messages: sql<number>`(select count(*)::int from message m where m.conversation_id = ${schema.conversation.id})`,
    })
    .from(schema.conversation)
    .innerJoin(schema.repository, eq(schema.repository.id, schema.conversation.repositoryId))
    .where(
      and(
        eq(schema.conversation.ownerId, user.id),
        repoId && z.uuid().safeParse(repoId).success ? eq(schema.conversation.repositoryId, repoId) : undefined,
        kind === "chat" || kind === "stuck" ? eq(schema.conversation.kind, kind) : undefined,
      ),
    )
    .orderBy(desc(schema.conversation.updatedAt))
    .limit(limit);
  return NextResponse.json({ conversations: rows });
});
