import { NextResponse } from "next/server";
import { z } from "zod";
import { symbolRelations } from "@/lib/repos/relations";
import { requireOwnedRepository } from "@/lib/security/access";
import { ApiError, withUser } from "@/lib/security/api";

/** Call-site evidence for a symbol: who it calls, who calls it, with lines and derivation. */
export const GET = withUser<{ id: string; symbolId: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  if (!z.uuid().safeParse(params.symbolId).success) throw new ApiError(404, "not_found", "Symbol not found");
  const rel = await symbolRelations(repo.id, params.symbolId);
  if (!rel) throw new ApiError(404, "not_found", "Symbol not found");
  return NextResponse.json(rel);
});
