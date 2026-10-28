import { NextResponse } from "next/server";
import { z } from "zod";
import { computeImpact } from "@/lib/repos/impact";
import { requireOwnedRepository } from "@/lib/security/access";
import { ApiError, parseBody, withUser } from "@/lib/security/api";

const Query = z.object({ file: z.uuid().optional(), symbol: z.uuid().optional() }).refine((q) => q.file || q.symbol, "file or symbol is required");

export const GET = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  const q = parseBody(Query, Object.fromEntries(new URL(req.url).searchParams));
  const impact = await computeImpact(repo.id, { fileId: q.file, symbolId: q.symbol });
  if (!impact) throw new ApiError(404, "not_found", "That file or symbol isn't in this repository's index");
  return NextResponse.json(impact);
});
