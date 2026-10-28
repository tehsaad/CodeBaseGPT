import { NextResponse } from "next/server";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";

const { savedAnswer, message, conversation, repository } = schema;
const Body = z.object({ messageId: z.uuid() });

async function ownedAssistantMessage(userId: string, messageId: string) {
  const db = await getDb();
  const [row] = await db
    .select({ id: message.id })
    .from(message)
    .innerJoin(conversation, eq(conversation.id, message.conversationId))
    .where(and(eq(message.id, messageId), eq(conversation.ownerId, userId), eq(message.role, "assistant")));
  if (!row) throw new ApiError(404, "not_found", "Answer not found");
}

export const GET = withUser(async (_req, { user }) => {
  const db = await getDb();
  const rows = await db
    .select({ id: savedAnswer.id, savedAt: savedAnswer.createdAt, messageId: message.id, content: message.content, model: message.model, conversationId: conversation.id, title: conversation.title, kind: conversation.kind, repositoryId: repository.id, repositoryName: repository.fullName })
    .from(savedAnswer)
    .innerJoin(message, eq(message.id, savedAnswer.messageId))
    .innerJoin(conversation, eq(conversation.id, message.conversationId))
    .innerJoin(repository, eq(repository.id, conversation.repositoryId))
    .where(eq(savedAnswer.ownerId, user.id))
    .orderBy(desc(savedAnswer.createdAt))
    .limit(100);
  return NextResponse.json({ saved: rows });
});

export const POST = withUser(async (req, { user }) => {
  const { messageId } = parseBody(Body, await readJson(req));
  await ownedAssistantMessage(user.id, messageId);
  const db = await getDb();
  await db.insert(savedAnswer).values({ ownerId: user.id, messageId }).onConflictDoNothing();
  return NextResponse.json({ ok: true }, { status: 201 });
});

export const DELETE = withUser(async (req, { user }) => {
  const { messageId } = parseBody(Body, await readJson(req));
  const db = await getDb();
  await db.delete(savedAnswer).where(and(eq(savedAnswer.ownerId, user.id), eq(savedAnswer.messageId, messageId)));
  return new NextResponse(null, { status: 204 });
});
