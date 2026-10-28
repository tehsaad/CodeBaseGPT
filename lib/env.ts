import { z } from "zod";

const optional = z
  .string()
  .trim()
  .optional()
  .transform((v) => (v ? v : undefined));

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: optional,
  CBG_ALLOW_EMBEDDED_DB: optional,
  CBG_DATA_DIR: optional,

  BETTER_AUTH_SECRET: optional,
  BETTER_AUTH_URL: optional,
  GITHUB_CLIENT_ID: optional,
  GITHUB_CLIENT_SECRET: optional,
  GOOGLE_CLIENT_ID: optional,
  GOOGLE_CLIENT_SECRET: optional,
  RESEND_API_KEY: optional,
  EMAIL_FROM: optional,

  GEMMA_PROVIDER: z.enum(["google", "openai-compatible", "gateway"]).optional(),
  GEMMA_FALLBACK_MODEL: optional,
  AI_GATEWAY_API_KEY: optional,
  SANDBOX_SNAPSHOT_ID: optional,
  GEMMA_MODEL: optional,
  GEMMA_API_KEY: optional,
  GEMMA_BASE_URL: optional,
  GEMMA_CONTEXT_TOKENS: z.coerce.number().int().positive().optional(),
  GEMMA_MAX_OUTPUT_TOKENS: z.coerce.number().int().positive().optional(),

  EMBEDDING_PROVIDER: z.enum(["google", "none"]).optional(),
  EMBEDDING_MODEL: optional,
  EMBEDDING_API_KEY: optional,

  SEARCH_PROVIDER: z.enum(["tavily", "exa"]).optional(),
  TAVILY_API_KEY: optional,
  EXA_API_KEY: optional,

  GITHUB_TOKEN: optional,
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (!cached) cached = schema.parse(process.env);
  return cached;
}

export function resetEnvForTests() {
  cached = undefined;
}

export type ProviderStatus = {
  configured: boolean;
  provider?: string;
  model?: string;
  missing: string[];
};

export function gemmaStatus(e: Env = env()): ProviderStatus {
  const provider = e.GEMMA_PROVIDER ?? (e.GEMMA_BASE_URL ? "openai-compatible" : "google");
  const missing: string[] = [];
  if (!e.GEMMA_MODEL) missing.push("GEMMA_MODEL");
  if (provider === "google" && !e.GEMMA_API_KEY) missing.push("GEMMA_API_KEY");
  if (provider === "gateway" && !e.AI_GATEWAY_API_KEY && !process.env.VERCEL_OIDC_TOKEN && !process.env.VERCEL) missing.push("AI_GATEWAY_API_KEY");
  if (provider === "openai-compatible" && !e.GEMMA_BASE_URL) missing.push("GEMMA_BASE_URL");
  return { configured: missing.length === 0, provider, model: e.GEMMA_MODEL, missing };
}

export function searchStatus(e: Env = env()): ProviderStatus {
  const provider = e.SEARCH_PROVIDER ?? (e.EXA_API_KEY && !e.TAVILY_API_KEY ? "exa" : "tavily");
  const key = provider === "exa" ? e.EXA_API_KEY : e.TAVILY_API_KEY;
  const missing = key ? [] : [provider === "exa" ? "EXA_API_KEY" : "TAVILY_API_KEY"];
  return { configured: missing.length === 0, provider, missing };
}

export function embeddingStatus(e: Env = env()): ProviderStatus {
  if (e.EMBEDDING_PROVIDER === "none" || !e.EMBEDDING_PROVIDER) {
    return { configured: false, provider: "none", missing: ["EMBEDDING_PROVIDER"] };
  }
  const key = e.EMBEDDING_API_KEY ?? e.GEMMA_API_KEY;
  return {
    configured: Boolean(key),
    provider: e.EMBEDDING_PROVIDER,
    model: e.EMBEDDING_MODEL ?? "gemini-embedding-001",
    missing: key ? [] : ["EMBEDDING_API_KEY"],
  };
}

export function oauthStatus(e: Env = env()) {
  return {
    github: Boolean(e.GITHUB_CLIENT_ID && e.GITHUB_CLIENT_SECRET),
    google: Boolean(e.GOOGLE_CLIENT_ID && e.GOOGLE_CLIENT_SECRET),
    email: Boolean(e.RESEND_API_KEY && e.EMAIL_FROM),
  };
}

/** Code runner: Vercel Sandbox authenticates with the deployment OIDC token, or VERCEL_TOKEN outside Vercel. */
export function sandboxStatus(e: Env = env()) {
  const auth = Boolean(process.env.VERCEL || process.env.VERCEL_OIDC_TOKEN || process.env.VERCEL_TOKEN);
  return {
    configured: auth,
    compiledLanguages: Boolean(e.SANDBOX_SNAPSHOT_ID),
    missing: [...(auth ? [] : ["VERCEL_OIDC_TOKEN"]), ...(e.SANDBOX_SNAPSHOT_ID ? [] : ["SANDBOX_SNAPSHOT_ID"])],
  };
}
