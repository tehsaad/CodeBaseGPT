import type { ExtractedSymbol } from "./parser";

export type Chunk = {
  startLine: number;
  endLine: number;
  content: string;
  searchText: string;
  symbolIndex: number | null;
};

const MAX_LINES = 120;
const WINDOW = 60;
const OVERLAP = 10;
const MAX_CHARS = 8000;

/** Splits identifiers so "getUserSession" and "get_user_session" both match "user session". */
export function identifierTokens(text: string): string {
  const words = text.match(/[A-Za-z_][A-Za-z0-9_]*/g) ?? [];
  const out = new Set<string>();
  for (const w of words) {
    if (w.length < 2) continue;
    const parts = w
      .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
      .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
      .split(/[_\s]+/)
      .filter((p) => p.length > 1);
    if (parts.length > 1) for (const p of parts) out.add(p.toLowerCase());
  }
  return [...out].join(" ");
}

function slice(lines: string[], start: number, end: number) {
  return lines.slice(start - 1, end).join("\n").slice(0, MAX_CHARS);
}

function windows(start: number, end: number): [number, number][] {
  const out: [number, number][] = [];
  for (let s = start; s <= end; s += WINDOW - OVERLAP) {
    const e = Math.min(end, s + WINDOW - 1);
    out.push([s, e]);
    if (e >= end) break;
  }
  return out;
}

/**
 * Structure-aware chunking: one chunk per top-level symbol (large classes are split per method),
 * with line windows for code between symbols and for files without parsed symbols.
 */
export function chunkFile(filePath: string, content: string, symbols: ExtractedSymbol[]): Chunk[] {
  const lines = content.split("\n");
  const total = lines.length;
  const chunks: Chunk[] = [];
  const header = `${filePath} ${identifierTokens(filePath.replace(/[/.]/g, " "))}`;

  const push = (startLine: number, endLine: number, symbolIndex: number | null) => {
    const text = slice(lines, startLine, endLine);
    if (!text.trim()) return;
    const sym = symbolIndex !== null ? symbols[symbolIndex] : null;
    const symText = sym ? `${sym.parentName ? `${sym.parentName} ` : ""}${sym.name} ${sym.kind}` : "";
    chunks.push({
      startLine,
      endLine,
      content: text,
      searchText: `${header} ${symText} ${text} ${identifierTokens(text)}`,
      symbolIndex,
    });
  };

  const topLevel = symbols
    .map((s, i) => ({ s, i }))
    .filter(({ s }) => !symbols.some((p) => p !== s && p.startLine <= s.startLine && p.endLine >= s.endLine && (p.kind === "function" || p.kind === "method")))
    .filter(({ s }) => s.kind !== "namespace")
    .filter(({ s }) => !s.parentName || !symbols.some((p) => p.name === s.parentName && p.endLine - p.startLine + 1 <= MAX_LINES && p.startLine <= s.startLine && p.endLine >= s.endLine))
    .sort((a, b) => a.s.startLine - b.s.startLine);

  const covered: [number, number][] = [];
  for (const { s, i } of topLevel) {
    if (covered.some(([a, b]) => s.startLine >= a && s.endLine <= b)) continue;
    const size = s.endLine - s.startLine + 1;
    if (size <= MAX_LINES) {
      push(s.startLine, s.endLine, i);
      covered.push([s.startLine, s.endLine]);
    } else if (s.kind === "class" || s.kind === "struct") {
      // Large class: index its header; member methods get their own chunks.
      const firstMember = symbols
        .filter((m) => m.parentName === s.name && m.startLine > s.startLine && m.endLine <= s.endLine)
        .reduce((min, m) => Math.min(min, m.startLine), s.endLine);
      push(s.startLine, Math.min(firstMember - 1, s.startLine + WINDOW - 1), i);
    } else {
      for (const [a, b] of windows(s.startLine, s.endLine)) push(a, b, i);
      covered.push([s.startLine, s.endLine]);
    }
  }

  // Gaps not covered by any symbol chunk (imports, top-level statements, unparsed files).
  const sorted = covered.sort((a, b) => a[0] - b[0]);
  let cursor = 1;
  const gaps: [number, number][] = [];
  for (const [a, b] of sorted) {
    if (a > cursor) gaps.push([cursor, a - 1]);
    cursor = Math.max(cursor, b + 1);
  }
  if (cursor <= total) gaps.push([cursor, total]);
  for (const [a, b] of gaps) for (const [s, e] of windows(a, b)) push(s, e, null);

  return chunks.sort((a, b) => a.startLine - b.startLine);
}
