import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { gateway } from "@ai-sdk/gateway";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env, gemmaStatus } from "@/lib/env";

export type ModelHandle = {
  model: LanguageModel;
  /** Human-readable identity shown next to every answer, e.g. "gemma-4-26b-a4b-it via Google AI Studio". */
  label: string;
  modelId: string;
  /** Gemma 1–3 on the Gemini API reject system instructions, so policy is then sent in the first user turn. */
  supportsSystemRole: boolean;
  contextTokens: number;
  maxRetries: number;
  /** Retries for provider errors that arrive after streaming has started. */
  streamRetries: number;
  /** Includes hidden reasoning for thinking models (Gemma 4 spends ~700 tokens thinking before answering). */
  maxOutputTokens: number;
  /** Another Gemma model tried when this one produces no text (the answer label shows which one answered). */
  fallback?: ModelHandle;
};

export class ProviderNotConfiguredError extends Error {
  constructor(public missing: string[]) {
    super(`Gemma is not configured. Missing: ${missing.join(", ")}`);
  }
}

let override: ModelHandle | null = null;

/** Test hook: inject a mock language model. */
export function setModelOverrideForTests(handle: ModelHandle | null) {
  override = handle;
}

function outputBudget(modelId: string) {
  return env().GEMMA_MAX_OUTPUT_TOKENS ?? (/gemma-4/i.test(modelId) ? 6144 : 1600);
}

function buildHandle(provider: string, modelId: string): ModelHandle {
  const e = env();
  const contextTokens = e.GEMMA_CONTEXT_TOKENS ?? 32_000;
  if (provider === "openai-compatible") {
    const p = createOpenAICompatible({ name: "gemma-endpoint", baseURL: e.GEMMA_BASE_URL!, apiKey: e.GEMMA_API_KEY });
    let host = "custom endpoint";
    try {
      host = new URL(e.GEMMA_BASE_URL!).host;
    } catch {}
    return { model: p.chatModel(modelId), label: `${modelId} via ${host}`, modelId, supportsSystemRole: true, contextTokens, maxRetries: 2, streamRetries: 1, maxOutputTokens: outputBudget(modelId) };
  }
  if (provider === "gateway") {
    // Vercel AI Gateway: authenticates with the deployment's OIDC token (or AI_GATEWAY_API_KEY).
    const id = modelId.includes("/") ? modelId : `google/${modelId}`;
    return { model: gateway(id), label: `${id} via Vercel AI Gateway`, modelId: id, supportsSystemRole: true, contextTokens, maxRetries: 3, streamRetries: 2, maxOutputTokens: outputBudget(id) };
  }
  const google = createGoogleGenerativeAI({ apiKey: e.GEMMA_API_KEY });
  return {
    model: google(modelId),
    label: `${modelId} via Google AI Studio`,
    modelId,
    // Gemma 1–3 on the Gemini API reject system instructions; Gemma 4 accepts them (verified 2026-10-28).
    supportsSystemRole: !/^gemma-[123](n)?-/i.test(modelId),
    contextTokens,
    // Hosted Gemma 4 intermittently returns 500 INTERNAL (5 of 6 cold calls in our benchmark); retries with backoff recover.
    maxRetries: 5,
    streamRetries: 3,
    maxOutputTokens: outputBudget(modelId),
  };
}

export function getGemma(): ModelHandle {
  if (override) return override;
  const status = gemmaStatus();
  if (!status.configured) throw new ProviderNotConfiguredError(status.missing);
  const e = env();
  const primary = buildHandle(status.provider!, e.GEMMA_MODEL!);
  if (e.GEMMA_FALLBACK_MODEL && e.GEMMA_FALLBACK_MODEL !== e.GEMMA_MODEL) primary.fallback = buildHandle(status.provider!, e.GEMMA_FALLBACK_MODEL);
  return primary;
}

/** Maps provider failures to safe, user-facing messages without leaking keys or raw payloads. */
export function describeProviderError(error: unknown): { code: string; message: string; status: number } {
  const e = error as { statusCode?: number; name?: string; message?: string };
  const status = e?.statusCode;
  if (e?.name === "AbortError" || e?.name === "TimeoutError" || /timed? ?out/i.test(e?.message ?? "")) {
    return { code: "provider_timeout", message: "The model took too long to respond. Try a narrower question.", status: 504 };
  }
  if (status === 429) return { code: "provider_rate_limited", message: "The model provider is rate limiting requests. Wait a moment and retry.", status: 429 };
  if (status === 401 || status === 403) return { code: "provider_auth", message: "The model provider rejected the API key. Check GEMMA_API_KEY.", status: 502 };
  if (status === 404) return { code: "provider_model_not_found", message: "The configured GEMMA_MODEL was not found at the provider.", status: 502 };
  if (status === 400 && /system|developer instruction/i.test(e?.message ?? "")) {
    return { code: "provider_bad_request", message: "The model rejected the request format.", status: 502 };
  }
  return { code: "provider_error", message: "The model provider returned an error. Please retry.", status: 502 };
}
