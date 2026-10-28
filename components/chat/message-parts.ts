import type { CbgDataParts, CbgUIMessage, EvidenceItem, WebItem } from "@/lib/ai/types";

export function partsOf(m: CbgUIMessage) {
  let text = "";
  let evidence: EvidenceItem[] = [];
  let web: CbgDataParts["web"] | null = null;
  let citations: CbgDataParts["citations"] | null = null;
  let status: CbgDataParts["status"] | null = null;
  let meta: CbgDataParts["meta"] | null = null;
  let progress: CbgDataParts["progress"] | null = null;
  for (const p of m.parts) {
    if (p.type === "text") text += p.text;
    else if (p.type === "data-evidence") evidence = p.data.items;
    else if (p.type === "data-web") web = p.data;
    else if (p.type === "data-citations") citations = p.data;
    else if (p.type === "data-status") status = p.data;
    else if (p.type === "data-meta") meta = p.data;
    else if (p.type === "data-progress") progress = p.data;
  }
  return { text, evidence, web, citations, status, meta, progress };
}

type StoredCitation = { kind: "repo" | "web"; label: string; cited: boolean; fileId: string | null; path: string | null; startLine: number | null; endLine: number | null; symbol: string | null; url: string | null; title: string | null; domain: string | null; snippet: string | null; publishedAt: string | null };
type StoredMessage = { id: string; role: "user" | "assistant"; content: string; status: string; model: string | null; meta: Record<string, unknown> | null; citations: StoredCitation[] };

/** Rebuilds UI messages (with evidence + citation parts) from a persisted conversation. */
export function fromStored(conversationId: string, kind: "chat" | "stuck", messages: StoredMessage[]): CbgUIMessage[] {
  return messages.map((m) => {
    if (m.role === "user") return { id: m.id, role: "user", parts: [{ type: "text", text: m.content }] } as CbgUIMessage;
    const evidence: EvidenceItem[] = m.citations
      .filter((c) => c.kind === "repo" && c.fileId)
      .map((c) => ({ label: c.label, fileId: c.fileId!, path: c.path!, startLine: c.startLine!, endLine: c.endLine!, symbol: c.symbol, reason: "lexical", language: null, preview: "" }));
    const web: WebItem[] = m.citations.filter((c) => c.kind === "web" && c.url).map((c) => ({ label: c.label, title: c.title ?? c.url!, url: c.url!, domain: c.domain ?? "", snippet: c.snippet ?? "", publishedAt: c.publishedAt }));
    const used = m.citations.filter((c) => c.cited).map((c) => c.label);
    const parts: CbgUIMessage["parts"] = [
      { type: "data-meta", data: { conversationId, messageId: m.id, model: m.model, kind } },
      { type: "data-evidence", data: { items: evidence } },
      ...(kind === "stuck" ? [{ type: "data-web" as const, data: { status: web.length ? ("ok" as const) : ("skipped" as const), queries: [], items: web } }] : []),
      ...(m.status === "complete" ? [{ type: "data-citations" as const, data: { used, invalid: ((m.meta?.invalidCitations as string[]) ?? []) } }] : []),
      ...(m.status !== "complete" ? [{ type: "data-status" as const, data: { code: (m.meta?.code as string) ?? m.status, message: m.status === "insufficient_evidence" ? "No matching code was found" : "No AI answer", kind: m.status === "insufficient_evidence" ? ("notice" as const) : ("error" as const) } }] : []),
      { type: "text", text: m.content },
    ];
    return { id: m.id, role: "assistant", parts } as CbgUIMessage;
  });
}
