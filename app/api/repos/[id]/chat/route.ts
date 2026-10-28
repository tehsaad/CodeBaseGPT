import { streamGroundedAnswer, addUserMessage, startConversation } from "@/lib/ai/answer";
import { CHAT_POLICY } from "@/lib/ai/prompts";
import { ChatBody } from "@/lib/ai/requests";
import { retrieve } from "@/lib/ai/retrieval";
import { requireReady } from "@/lib/repos/guards";
import { requireOwnedConversation, requireOwnedRepository } from "@/lib/security/access";
import { ApiError, parseBody, readJson, withUser } from "@/lib/security/api";
import { enforceRateLimit } from "@/lib/security/rate-limit";

export const maxDuration = 120;

export const POST = withUser<{ id: string }>(async (req, { user, params }) => {
  const repo = await requireOwnedRepository(user.id, params.id);
  requireReady(repo);
  const body = parseBody(ChatBody, await readJson(req));
  await enforceRateLimit("chat", user.id);

  let conversationId = body.conversationId;
  if (conversationId) {
    const convo = await requireOwnedConversation(user.id, conversationId);
    if (convo.repositoryId !== repo.id || convo.kind !== "chat") throw new ApiError(404, "not_found", "Conversation not found");
  } else {
    conversationId = (await startConversation(user.id, repo.id, "chat", body.message)).id;
  }
  await addUserMessage(conversationId, body.message, body.focus ? { focus: body.focus } : undefined);
  const evidence = await retrieve({ repoId: repo.id, question: body.message, focus: body.focus });

  return streamGroundedAnswer({
    kind: "chat",
    conversationId,
    question: body.message,
    evidence,
    policy: CHAT_POLICY,
    emptyMessage:
      "**I couldn't find code in this repository that matches your question**, so I won't guess.\n\nTry naming a file, function, or feature (for example `signIn` or `auth/session`), select a node in the Atlas and ask about it, or use **I'm stuck** to search the web.",
  });
});
