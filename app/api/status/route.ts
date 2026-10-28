import { NextResponse } from "next/server";
import { embeddingStatus, gemmaStatus, oauthStatus, searchStatus } from "@/lib/env";

/** Public configuration status (booleans and variable names only — never values). */
export async function GET() {
  const gemma = gemmaStatus();
  const search = searchStatus();
  const embeddings = embeddingStatus();
  return NextResponse.json({
    gemma: { configured: gemma.configured, provider: gemma.provider, model: gemma.configured ? gemma.model : undefined, missing: gemma.missing },
    search: { configured: search.configured, provider: search.provider, missing: search.missing },
    embeddings: { configured: embeddings.configured, missing: embeddings.missing },
    oauth: oauthStatus(),
  });
}
