import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { conversationMessages } from "@/lib/ai/answer";
import { getDb, schema } from "@/lib/db";
import { requireOwnedConversation } from "@/lib/security/access";
import { withUser } from "@/lib/security/api";

type P = { conversationId: string };

export const GET = withUser<P>(async (_req, { user, params }) => {
  const convo = await requireOwnedConversation(user.id, params.conversationId);
  return NextResponse.json({ conversation: convo, messages: await conversationMessages(convo.id) });
});

export const DELETE = withUser<P>(async (_req, { user, params }) => {
  const convo = await requireOwnedConversation(user.id, params.conversationId);
  const db = await getDb();
  await db.delete(schema.conversation).where(eq(schema.conversation.id, convo.id));
  return new NextResponse(null, { status: 204 });
});
