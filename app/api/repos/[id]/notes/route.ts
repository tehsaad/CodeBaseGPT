import { NextResponse } from "next/server";
import { getDb, schema } from "@/lib/db";
import { anchorFor, listNotes, NoteInput } from "@/lib/repos/notes";
import { requireOwnedRepository } from "@/lib/security/access";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";

export const GET = withUser<{ id: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  return NextResponse.json({ notes: await listNotes(repo.id, user.id) });
});

export const POST = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const body = parseBody(NoteInput, await readJson(req));
  const anchor = await anchorFor(repo.id, body.fileId);
  if (!anchor) throw new ApiError(404, "not_found", "That file isn't in this repository");
  const db = await getDb();
  const [note] = await db
    .insert(schema.repoNote)
    .values({ repositoryId: repo.id, ownerId: user.id, kind: body.kind, title: body.title, body: body.body, path: anchor.path, fileHash: anchor.fileHash, startLine: anchor.path ? (body.startLine ?? null) : null, endLine: anchor.path ? (body.endLine ?? body.startLine ?? null) : null })
    .returning();
  return NextResponse.json({ note }, { status: 201 });
});
