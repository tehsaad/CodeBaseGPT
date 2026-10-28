import { NextResponse } from "next/server";
import { loadArtifact, streamGuide } from "@/lib/ai/guide";
import { repoFacts } from "@/lib/repos/overview";
import { requireReady } from "@/lib/repos/guards";
import { requireOwnedRepository } from "@/lib/security/access";
import { withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 180;

/** Deterministic facts (always) plus the cached AI guide, if one was generated. */
export const GET = withUser<{ id: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  requireReady(repo);
  const [facts, guide] = await Promise.all([repoFacts(repo), loadArtifact(repo, "guide")]);
  return NextResponse.json({ facts, guide });
});

/** Generates (or regenerates) the AI guide, streaming it. */
export const POST = withUser<{ id: string }>(async (_req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  requireReady(repo);
  await enforceRateLimit("artifact", user.id);
  return streamGuide(repo, user.id);
});
