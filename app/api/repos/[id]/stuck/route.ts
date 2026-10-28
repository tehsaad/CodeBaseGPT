import { addUserMessage, startConversation, streamGroundedAnswer } from "@/lib/ai/answer";
import { neutralize, STUCK_POLICY } from "@/lib/ai/prompts";
import { StuckBody } from "@/lib/ai/requests";
import { planStuck, runWebResearch } from "@/lib/ai/stuck";
import { requireReady } from "@/lib/repos/guards";
import { requireOwnedConversation, requireOwnedRepository } from "@/lib/security/access";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 120;

export const POST = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  requireReady(repo);
  const body = parseBody(StuckBody, await readJson(req));
  await enforceRateLimit("stuck", user.id);

  let conversationId = body.conversationId;
  if (conversationId) {
    const convo = await requireOwnedConversation(user.id, conversationId);
    if (convo.repositoryId !== repo.id || convo.kind !== "stuck") throw new ApiError(404, "not_found", "Conversation not found");
  } else {
    conversationId = (await startConversation(user.id, repo.id, "stuck", body.problem)).id;
  }
  await addUserMessage(conversationId, body.problem, { errorText: body.errorText, code: body.code, level: body.level, queries: body.queries });

  const plan = await planStuck(repo, body);
  const queries = body.queries.length ? body.queries : plan.queries.slice(0, 2);
  const research = body.searchWeb
    ? await runWebResearch({ ownerId: user.id, repoId: repo.id, conversationId, queries })
    : { part: { status: "skipped" as const, queries: [], items: [], message: "Web search was turned off for this question." }, evidence: [] };

  const studentContext = [
    body.errorText ? `<student_error>\n${neutralize(body.errorText.slice(0, 4000))}\n</student_error>` : "",
    body.code ? `<student_code>\n${neutralize(body.code.slice(0, 4000))}\n</student_code>` : "",
  ]
    .filter(Boolean)
    .join("\n\n");

  return streamGroundedAnswer({
    kind: "stuck",
    conversationId,
    question: body.problem,
    evidence: plan.evidence,
    web: research.part,
    webEvidence: research.evidence,
    policy: STUCK_POLICY,
    level: body.level,
    extraContext: studentContext || undefined,
  });
});
