import { NextResponse } from "next/server";
import { computeInsights } from "@/lib/repos/insights";
import { requireOwnedRepository } from "@/lib/security/access";
import { withUser } from "@/lib/security/api";

export const GET = withUser<{ id: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  return NextResponse.json({ repository: repo, insights: await computeInsights(repo.id) });
});
