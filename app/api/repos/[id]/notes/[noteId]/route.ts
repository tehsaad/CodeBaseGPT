import { and, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { NOTE_KINDS } from "@/lib/repos/notes";
import { requireOwnedRepository } from "@/lib/security/access";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";

const Patch = z.object({ kind: z.enum(NOTE_KINDS).optional(), title: z.string().trim().min(1).max(200).optional(), body: z.string().max(20_000).optional() });

async function owned(userId: string, repoId: string, noteId: string) {
  const repo = await requireOwnedRepository(userId, repoId);
  if (!z.uuid().safeParse(noteId).success) throw new ApiError(404, "not_found", "Note not found");
  const n = schema.repoNote;
  return { repo, where: and(eq(n.id, noteId), eq(n.repositoryId, repo.id), eq(n.ownerId, userId)) };
}

export const PATCH = withUser<{ id: string; noteId: string }>(async (req, { user, params }) => {
  const { where } = await owned(user.id, params.id, params.noteId);
  const body = parseBody(Patch, await readJson(req));
  const db = await getDb();
  const [note] = await db.update(schema.repoNote).set({ ...body, updatedAt: new Date() }).where(where).returning();
  if (!note) throw new ApiError(404, "not_found", "Note not found");
  return NextResponse.json({ note });
});

export const DELETE = withUser<{ id: string; noteId: string }>(async (_req, { user, params }) => {
  const { where } = await owned(user.id, params.id, params.noteId);
  const db = await getDb();
  const rows = await db.delete(schema.repoNote).where(where).returning({ id: schema.repoNote.id });
  if (!rows.length) throw new ApiError(404, "not_found", "Note not found");
  return NextResponse.json({ ok: true });
});
