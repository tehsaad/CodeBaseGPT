import type { UIMessage } from "ai";

export type EvidenceItem = {
  label: string;
  fileId: string;
  path: string;
  startLine: number;
  endLine: number;
  symbol: string | null;
  reason: string;
  language: string | null;
  preview: string;
};

export type WebItem = { label: string; id?: string; title: string; url: string; domain: string; snippet: string; publishedAt: string | null };

export type StreamStatus = { code: string; message: string; kind: "error" | "notice" };

export type CbgDataParts = {
  meta: { conversationId: string; messageId: string; model: string | null; kind: "chat" | "stuck" };
  evidence: { items: EvidenceItem[] };
  web: { status: "ok" | "not_configured" | "failed" | "skipped"; message?: string; provider?: string; queries: string[]; items: WebItem[] };
  citations: { used: string[]; invalid: string[] };
  status: StreamStatus;
};

export type CbgUIMessage = UIMessage<never, CbgDataParts>;
