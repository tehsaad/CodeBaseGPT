import "server-only";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { ApiError } from "./api";

const uuid = z.uuid();

/**
 * Loads a repository only if it belongs to the user. Responds 404 (not 403) for other users'
 * repositories so that IDs can't be probed for existence.
 */
export async function requireOwnedRepository(userId: string, repoId: string) {
  if (!uuid.safeParse(repoId).success) throw new ApiError(404, "not_found", "Repository not found");
  const db = await getDb();
  const [repo] = await db
    .select()
    .from(schema.repository)
    .where(and(eq(schema.repository.id, repoId), eq(schema.repository.ownerId, userId)))
    .limit(1);
  if (!repo) throw new ApiError(404, "not_found", "Repository not found");
  return repo;
}

export async function requireOwnedConversation(userId: string, conversationId: string) {
  if (!uuid.safeParse(conversationId).success) throw new ApiError(404, "not_found", "Conversation not found");
  const db = await getDb();
  const [row] = await db
    .select()
    .from(schema.conversation)
    .where(and(eq(schema.conversation.id, conversationId), eq(schema.conversation.ownerId, userId)))
    .limit(1);
  if (!row) throw new ApiError(404, "not_found", "Conversation not found");
  return row;
}
