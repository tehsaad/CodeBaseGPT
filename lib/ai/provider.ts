import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";
import type { LanguageModel } from "ai";
import { env, gemmaStatus } from "@/lib/env";

export type ModelHandle = {
  model: LanguageModel;
  /** Human-readable identity shown next to every answer, e.g. "gemma-3-27b-it via Google AI". */
  label: string;
  modelId: string;
  /** Gemma on the Gemini API rejects system instructions, so policy is sent in the first user turn. */
  supportsSystemRole: boolean;
  contextTokens: number;
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

export function getGemma(): ModelHandle {
  if (override) return override;
  const status = gemmaStatus();
  if (!status.configured) throw new ProviderNotConfiguredError(status.missing);
  const e = env();
  const modelId = e.GEMMA_MODEL!;
  if (status.provider === "openai-compatible") {
    const provider = createOpenAICompatible({ name: "gemma-endpoint", baseURL: e.GEMMA_BASE_URL!, apiKey: e.GEMMA_API_KEY });
    let host = "custom endpoint";
    try {
      host = new URL(e.GEMMA_BASE_URL!).host;
    } catch {}
    return {
      model: provider.chatModel(modelId),
      label: `${modelId} via ${host}`,
      modelId,
      supportsSystemRole: true,
      contextTokens: e.GEMMA_CONTEXT_TOKENS ?? 32_000,
    };
  }
  const google = createGoogleGenerativeAI({ apiKey: e.GEMMA_API_KEY });
  return {
    model: google(modelId),
    label: `${modelId} via Google AI Studio`,
    modelId,
    supportsSystemRole: !/^gemma/i.test(modelId),
    contextTokens: e.GEMMA_CONTEXT_TOKENS ?? 32_000,
  };
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
