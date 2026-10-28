"use client";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";

export type ProviderStatus = {
  gemma: { configured: boolean; provider?: string; model?: string; missing: string[] };
  search: { configured: boolean; provider?: string; missing: string[] };
  embeddings: { configured: boolean; missing: string[] };
  oauth: { github: boolean; google: boolean; email: boolean };
  runner?: { configured: boolean; compiledLanguages: boolean; missing: string[] };
};

export function useProviderStatus() {
  return useSWR<ProviderStatus>("/api/status", fetcher, { revalidateOnFocus: false });
}
