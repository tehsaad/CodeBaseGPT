import "server-only";
import { createUIMessageStream, createUIMessageStreamResponse, streamText, toUIMessageStream } from "ai";
import { asc, desc, eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { log } from "@/lib/observability/log";
import { validateCitations } from "./citations";
import { buildPrompt, estimateTokens, renderEvidence, renderWeb, type HistoryTurn, type Level, type WebEvidence } from "./prompts";
import { describeProviderError, getGemma, ProviderNotConfiguredError, type ModelHandle } from "./provider";
import type { Evidence } from "./retrieval";
import type { CbgDataParts, CbgUIMessage, EvidenceItem, WebItem } from "./types";

const { message, citation, conversation } = schema;

export const MAX_OUTPUT_TOKENS = 1600;

export function toEvidenceItems(evidence: Evidence[]): EvidenceItem[] {
  return evidence.map((e) => ({
    label: e.label,
    fileId: e.fileId,
    path: e.path,
    startLine: e.startLine,
    endLine: e.endLine,
    symbol: e.symbol,
    reason: e.reason,
    language: e.language,
    preview: e.content.split("\n").slice(0, 14).join("\n").slice(0, 1200),
  }));
}

export async function loadHistory(conversationId: string): Promise<HistoryTurn[]> {
  const db = await getDb();
  const rows = await db
    .select({ role: message.role, content: message.content, status: message.status })
    .from(message)
    .where(eq(message.conversationId, conversationId))
    .orderBy(desc(message.createdAt))
    .limit(8);
  return rows.reverse().filter((r) => r.status === "complete").map((r) => ({ role: r.role, content: r.content }));
}

/** Drops lowest-ranked evidence until the prompt fits the model's context window. */
export function fitToBudget(evidence: Evidence[], web: WebEvidence[], fixedText: string, contextTokens: number) {
  const budget = contextTokens - MAX_OUTPUT_TOKENS - 500;
  let ev = [...evidence];
  let wb = [...web];
  const size = () => estimateTokens(fixedText + renderEvidence(ev) + renderWeb(wb));
  while (size() > budget && (ev.length > 0 || wb.length > 0)) {
    if (ev.length >= wb.length && ev.length > 0) ev = ev.slice(0, -1);
    else wb = wb.slice(0, -1);
  }
  return { evidence: ev, web: wb };
}

type AnswerOptions = {
  kind: "chat" | "stuck";
  conversationId: string;
  question: string;
  evidence: Evidence[];
  web?: CbgDataParts["web"];
  webEvidence?: WebEvidence[];
  policy: string;
  level?: Level;
  extraContext?: string;
  /** Shown when no repository evidence was found (and, for chat, no model call is made). */
  emptyMessage?: string;
};

async function persist(opts: {
  conversationId: string;
  messageId: string;
  content: string;
  status: "complete" | "error" | "insufficient_evidence";
  model: string | null;
  evidence: Evidence[];
  web: WebEvidence[];
  used: string[];
  meta?: Record<string, unknown>;
}) {
  const db = await getDb();
  await db.transaction(async (tx) => {
    await tx.insert(message).values({ id: opts.messageId, conversationId: opts.conversationId, role: "assistant", content: opts.content, status: opts.status, model: opts.model, meta: opts.meta });
    const used = new Set(opts.used);
    const rows = [
      ...opts.evidence.map((e) => ({ messageId: opts.messageId, kind: "repo" as const, label: e.label, cited: used.has(e.label), fileId: e.fileId, path: e.path, startLine: e.startLine, endLine: e.endLine, symbol: e.symbol })),
      ...opts.web.map((w) => ({ messageId: opts.messageId, kind: "web" as const, label: w.label, cited: used.has(w.label), url: w.url, title: w.title, domain: w.domain, snippet: w.snippet, publishedAt: w.publishedAt ?? null })),
    ];
    if (rows.length) await tx.insert(citation).values(rows);
    await tx.update(conversation).set({ updatedAt: new Date() }).where(eq(conversation.id, opts.conversationId));
  });
}

/**
 * Streams an evidence-grounded answer. Evidence (and web sources) are sent to the client before
 * any model output, so the UI can show exactly what the model saw. Citation labels in the answer
 * are validated against the supplied evidence; unknown labels are reported, never linked.
 */
export function streamGroundedAnswer(opts: AnswerOptions): Response {
  const messageId = crypto.randomUUID();
  const webEvidence = opts.webEvidence ?? [];

  const stream = createUIMessageStream<CbgUIMessage>({
    execute: async ({ writer }) => {
      writer.write({ type: "start", messageId });
      let model: ModelHandle | null = null;
      let providerMissing: string[] | null = null;
      try {
        model = getGemma();
      } catch (error) {
        if (error instanceof ProviderNotConfiguredError) providerMissing = error.missing;
        else throw error;
      }
      writer.write({ type: "data-meta", data: { conversationId: opts.conversationId, messageId, model: model?.label ?? null, kind: opts.kind } });
      if (opts.web) writer.write({ type: "data-web", data: opts.web });

      const fitted = model
        ? fitToBudget(opts.evidence, webEvidence, opts.policy + opts.question + (opts.extraContext ?? ""), model.contextTokens)
        : { evidence: opts.evidence, web: webEvidence };
      writer.write({ type: "data-evidence", data: { items: toEvidenceItems(fitted.evidence) } });

      const writeText = (text: string) => {
        const id = `t-${messageId}`;
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: text });
        writer.write({ type: "text-end", id });
      };

      const noEvidence = fitted.evidence.length === 0 && fitted.web.length === 0;
      if (noEvidence && opts.emptyMessage) {
        writer.write({ type: "data-status", data: { code: "insufficient_evidence", message: "No matching code was found", kind: "notice" } });
        writeText(opts.emptyMessage);
        await persist({ conversationId: opts.conversationId, messageId, content: opts.emptyMessage, status: "insufficient_evidence", model: null, evidence: [], web: [], used: [] });
        writer.write({ type: "finish" });
        return;
      }

      if (!model) {
        const lines = fitted.evidence.map((e) => `- [${e.label}] \`${e.path}\` lines ${e.startLine}–${e.endLine}${e.symbol ? ` (${e.symbol})` : ""}`);
        const webLines = fitted.web.map((w) => `- [${w.label}] [${w.title}](${w.url}) — ${w.domain}`);
        const text = [
          `**Gemma is not configured on this server, so no AI answer was generated.** Set ${providerMissing?.join(", ")} to enable answers (see the setup guide).`,
          lines.length ? `\nRetrieval found these code locations for your question (open them to read the code yourself):\n${lines.join("\n")}` : "",
          webLines.length ? `\nWeb sources found:\n${webLines.join("\n")}` : "",
        ].join("\n");
        writer.write({ type: "data-status", data: { code: "provider_not_configured", message: "Gemma is not configured", kind: "error" } });
        writeText(text);
        await persist({ conversationId: opts.conversationId, messageId, content: text, status: "error", model: null, evidence: fitted.evidence, web: fitted.web, used: [], meta: { code: "provider_not_configured" } });
        writer.write({ type: "finish" });
        return;
      }

      const history = await loadHistory(opts.conversationId);
      // The current question was already stored; don't repeat it as history.
      if (history.length && history[history.length - 1].role === "user") history.pop();
      const context = [opts.extraContext, renderEvidence(fitted.evidence), opts.kind === "stuck" ? renderWeb(fitted.web) : ""].filter(Boolean).join("\n\n");
      const prompt = buildPrompt({ policy: opts.policy, supportsSystemRole: model.supportsSystemRole, history, context, question: opts.question, level: opts.level });

      let failure: { code: string; message: string } | null = null;
      const result = streamText({
        model: model.model,
        system: prompt.system,
        messages: prompt.messages,
        maxOutputTokens: MAX_OUTPUT_TOKENS,
        temperature: 0.2,
        maxRetries: model.maxRetries,
        timeout: { totalMs: 90_000, firstChunkMs: 30_000 },
        onError: ({ error }) => {
          failure = describeProviderError(error);
          log("error", "llm.stream_error", { kind: opts.kind, error });
        },
      });
      writer.merge(
        toUIMessageStream({
          stream: result.stream,
          sendStart: false,
          sendFinish: false,
          onError: (error) => {
            failure ??= describeProviderError(error);
            return failure.message;
          },
        }),
      );

      let text = "";
      try {
        text = await result.text;
      } catch (error) {
        failure ??= describeProviderError(error);
      }
      const err = failure as { code: string; message: string } | null;
      if (err || !text.trim()) {
        const status = err ?? { code: "provider_empty", message: "The model returned an empty response." };
        writer.write({ type: "data-status", data: { ...status, kind: "error" } });
        await persist({ conversationId: opts.conversationId, messageId, content: text || status.message, status: "error", model: model.label, evidence: fitted.evidence, web: fitted.web, used: [], meta: { code: status.code } });
        writer.write({ type: "finish" });
        return;
      }
      const available = [...fitted.evidence.map((e) => e.label), ...fitted.web.map((w) => w.label)];
      const { used, invalid } = validateCitations(text, available);
      writer.write({ type: "data-citations", data: { used, invalid } });
      await persist({ conversationId: opts.conversationId, messageId, content: text, status: "complete", model: model.label, evidence: fitted.evidence, web: fitted.web, used, meta: invalid.length ? { invalidCitations: invalid } : undefined });
      writer.write({ type: "finish" });
    },
    onError: (error) => {
      log("error", "answer.stream_failed", { error });
      return "Something went wrong while generating the answer.";
    },
  });
  return createUIMessageStreamResponse({ stream });
}

export async function startConversation(ownerId: string, repoId: string, kind: "chat" | "stuck", firstMessage: string) {
  const db = await getDb();
  const title = firstMessage.replace(/\s+/g, " ").trim().slice(0, 80) || "Untitled";
  const [row] = await db.insert(conversation).values({ ownerId, repositoryId: repoId, kind, title }).returning();
  return row;
}

export async function addUserMessage(conversationId: string, content: string, meta?: Record<string, unknown>) {
  const db = await getDb();
  await db.insert(message).values({ conversationId, role: "user", content, meta });
}

export async function conversationMessages(conversationId: string) {
  const db = await getDb();
  const msgs = await db.select().from(message).where(eq(message.conversationId, conversationId)).orderBy(asc(message.createdAt));
  const cites = msgs.length
    ? await db.select({ citation }).from(citation).innerJoin(message, eq(message.id, citation.messageId)).where(eq(message.conversationId, conversationId))
    : [];
  const byMessage = new Map<string, (typeof citation.$inferSelect)[]>();
  for (const row of cites) byMessage.set(row.citation.messageId, [...(byMessage.get(row.citation.messageId) ?? []), row.citation]);
  return msgs.map((m) => ({ ...m, citations: (byMessage.get(m.id) ?? []).sort((a, b) => a.label.localeCompare(b.label, undefined, { numeric: true })) }));
}

export type { WebItem };
