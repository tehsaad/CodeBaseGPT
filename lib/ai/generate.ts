import "server-only";
import { streamText, type ModelMessage, type UIMessageStreamWriter } from "ai";
import { log } from "@/lib/observability/log";
import { describeProviderError, type ModelHandle } from "./provider";
import type { CbgUIMessage } from "./types";

export type Failure = { code: string; message: string };

/**
 * Streams answer text from the first model that produces any, writing text parts to the UI stream.
 * Hidden reasoning is never forwarded; instead a "thinking" progress part is shown so the user sees
 * activity during Gemma 4's long reasoning phase. If a model fails before writing any text, the next
 * model (e.g. a second Gemma variant) is tried and the label reports which one actually answered.
 */
export async function streamModelText(opts: {
  writer: UIMessageStreamWriter<CbgUIMessage>;
  progressId: string;
  textId: string;
  models: ModelHandle[];
  system?: string;
  messages: ModelMessage[];
  logKind: string;
  temperature?: number;
}): Promise<{ text: string; model: ModelHandle; failure: Failure | null }> {
  const startedAt = Date.now();
  let lastFailure: Failure | null = null;
  const progress = (phase: "waiting" | "thinking" | "writing" | "retrying", model: ModelHandle, attempt: number) =>
    opts.writer.write({ type: "data-progress", id: opts.progressId, data: { phase, model: model.label, attempt, startedAt } });

  for (let i = 0; i < opts.models.length; i++) {
    const model = opts.models[i];
    progress(i === 0 ? "waiting" : "retrying", model, i + 1);
    let text = "";
    let failure: Failure | null = null;
    let textOpen = false;
    let phase = "waiting";
    try {
      const result = streamText({
        model: model.model,
        system: model.supportsSystemRole ? opts.system : undefined,
        messages: opts.messages,
        maxOutputTokens: model.maxOutputTokens,
        temperature: opts.temperature ?? 0.2,
        maxRetries: model.maxRetries,
        streamRetries: model.streamRetries,
        timeout: { totalMs: 150_000, firstChunkMs: 90_000 },
        onError: ({ error }) => {
          failure ??= describeProviderError(error);
          log("warn", "llm.stream_error", { kind: opts.logKind, model: model.modelId, error });
        },
      });
      for await (const part of result.fullStream) {
        if (part.type === "reasoning-start" || part.type === "reasoning-delta") {
          if (phase !== "thinking" && !textOpen) {
            phase = "thinking";
            progress("thinking", model, i + 1);
          }
        } else if (part.type === "text-delta") {
          if (!textOpen) {
            textOpen = true;
            phase = "writing";
            progress("writing", model, i + 1);
            opts.writer.write({ type: "text-start", id: opts.textId });
          }
          text += part.text;
          opts.writer.write({ type: "text-delta", id: opts.textId, delta: part.text });
        } else if (part.type === "error") {
          failure ??= describeProviderError(part.error);
        } else if (part.type === "abort") {
          failure ??= { code: "provider_timeout", message: "The model took too long to respond. Try again or ask a narrower question." };
        }
      }
    } catch (error) {
      failure ??= describeProviderError(error);
    }
    if (textOpen) opts.writer.write({ type: "text-end", id: opts.textId });
    if (text.trim()) return { text, model, failure };
    lastFailure = failure ?? { code: "provider_empty", message: "The model returned no answer text. Try again or ask a narrower question." };
    log("warn", "llm.attempt_failed", { kind: opts.logKind, model: model.modelId, code: lastFailure.code, ms: Date.now() - startedAt });
  }
  return { text: "", model: opts.models[opts.models.length - 1], failure: lastFailure };
}
