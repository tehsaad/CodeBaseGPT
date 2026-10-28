import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { getDb, schema } from "@/lib/db";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";

const Body = z.object({ saved: z.boolean() });

export const PATCH = withUser<{ resultId: string }>(async (req, { user, params }) => {
  if (!z.uuid().safeParse(params.resultId).success) throw new ApiError(404, "not_found", "Result not found");
  const { saved } = parseBody(Body, await readJson(req));
  const db = await getDb();
  const [row] = await db
    .update(schema.webResult)
    .set({ saved })
    .where(and(eq(schema.webResult.id, params.resultId), eq(schema.webResult.ownerId, user.id)))
    .returning();
  if (!row) throw new ApiError(404, "not_found", "Result not found");
  return NextResponse.json({ result: row });
});
