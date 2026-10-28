import "server-only";
import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { embedMany } from "ai";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";
import { embeddingStatus, env } from "@/lib/env";

/** Embeds text with the configured provider. Throws if embeddings aren't configured. */
export async function embedTexts(values: string[], purpose: "document" | "query"): Promise<number[][]> {
  const status = embeddingStatus();
  if (!status.configured) throw new Error("Embeddings are not configured");
  const e = env();
  const google = createGoogleGenerativeAI({ apiKey: e.EMBEDDING_API_KEY ?? e.GEMMA_API_KEY });
  const { embeddings } = await embedMany({
    model: google.embedding(status.model!),
    values: values.map((v) => v.slice(0, 8000)),
    maxRetries: 2,
    abortSignal: AbortSignal.timeout(30_000),
    providerOptions: {
      google: {
        outputDimensionality: EMBEDDING_DIMENSIONS,
        taskType: purpose === "query" ? "CODE_RETRIEVAL_QUERY" : "RETRIEVAL_DOCUMENT",
      },
    },
  });
  return embeddings;
}
