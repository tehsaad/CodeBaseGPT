import { NextResponse } from "next/server";
import { toEvidenceItems } from "@/lib/ai/answer";
import { StuckBody } from "@/lib/ai/requests";
import { planStuck } from "@/lib/ai/stuck";
import { requireReady } from "@/lib/repos/guards";
import { requireOwnedRepository } from "@/lib/security/access";
import { parseBody, readJson, withUser } from "@/lib/security/api";

/** "Find related code": repository retrieval + suggested search queries. No model or web call. */
export const POST = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  requireReady(repo);
  const body = parseBody(StuckBody, await readJson(req));
  const plan = await planStuck(repo, body);
  return NextResponse.json({ evidence: toEvidenceItems(plan.evidence), queries: plan.queries, signature: plan.signature, search: plan.search });
});
