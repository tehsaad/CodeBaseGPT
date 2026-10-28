const GROUP = /\[((?:[CW]\d{1,3})(?:\s*[,;]\s*[CW]\d{1,3})*)\]/g;

/** Extracts citation labels like [C1], [W2], [C1, C3] from model output. */
export function citedLabels(text: string): string[] {
  const out = new Set<string>();
  for (const m of text.matchAll(GROUP)) for (const label of m[1].split(/\s*[,;]\s*/)) out.add(label);
  return [...out];
}

/**
 * Splits cited labels into those that map to evidence we actually supplied, and invalid ones
 * (labels the model made up). Invalid labels are surfaced to the user, never silently linked.
 */
export function validateCitations(text: string, available: Iterable<string>) {
  const known = new Set(available);
  const used: string[] = [];
  const invalid: string[] = [];
  for (const label of citedLabels(text)) (known.has(label) ? used : invalid).push(label);
  return { used, invalid };
}

export type CitationSegment = { type: "text"; text: string } | { type: "cite"; labels: string[] };

/** Splits text into plain segments and citation groups for rendering clickable chips. */
export function segmentCitations(text: string): CitationSegment[] {
  const out: CitationSegment[] = [];
  let last = 0;
  for (const m of text.matchAll(GROUP)) {
    if (m.index! > last) out.push({ type: "text", text: text.slice(last, m.index) });
    out.push({ type: "cite", labels: m[1].split(/\s*[,;]\s*/) });
    last = m.index! + m[0].length;
  }
  if (last < text.length) out.push({ type: "text", text: text.slice(last) });
  return out;
}
