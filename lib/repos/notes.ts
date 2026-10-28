import "server-only";
import { and, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";

const { repoNote, repoFile } = schema;

export const NOTE_KINDS = ["explanation", "decision", "debugging", "location", "learning", "question"] as const;

export const NoteInput = z
  .object({
    kind: z.enum(NOTE_KINDS),
    title: z.string().trim().min(1).max(200),
    body: z.string().max(20_000).default(""),
    fileId: z.uuid().optional(),
    startLine: z.number().int().min(1).optional(),
    endLine: z.number().int().min(1).optional(),
  })
  .refine((n) => !n.endLine || !n.startLine || n.endLine >= n.startLine, "endLine must be after startLine");

/** Resolves an optional file anchor inside this repository; the file hash marks the note as possibly stale later. */
export async function anchorFor(repoId: string, fileId?: string) {
  if (!fileId) return { path: null, fileHash: null };
  const db = await getDb();
  const [f] = await db.select({ path: repoFile.path, hash: repoFile.contentHash }).from(repoFile).where(and(eq(repoFile.id, fileId), eq(repoFile.repositoryId, repoId)));
  return f ? { path: f.path, fileHash: f.hash } : null;
}

export async function listNotes(repoId: string, ownerId: string) {
  const db = await getDb();
  const notes = await db.select().from(repoNote).where(and(eq(repoNote.repositoryId, repoId), eq(repoNote.ownerId, ownerId))).orderBy(desc(repoNote.updatedAt));
  const files = await db.select({ id: repoFile.id, path: repoFile.path, hash: repoFile.contentHash }).from(repoFile).where(eq(repoFile.repositoryId, repoId));
  const byPath = new Map(files.map((f) => [f.path, f]));
  return notes.map((n) => {
    const f = n.path ? byPath.get(n.path) : undefined;
    const anchor = n.path ? (f ? (f.hash === n.fileHash ? "current" : "changed") : "missing") : null;
    return { ...n, fileId: f?.id ?? null, anchor };
  });
}
