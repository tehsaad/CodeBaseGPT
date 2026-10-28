import { diffLines } from "diff";

/** The code block under the tutor's "## Fixed version" heading, if the answer has one. */
export function extractFixedCode(markdown: string): string | null {
  const section = markdown.split(/^##\s+/m).find((s) => /^fixed version\b/i.test(s));
  if (!section) return null;
  const m = section.match(/```[\w+#-]*\n([\s\S]*?)```/);
  const code = m?.[1]?.replace(/\n$/, "");
  return code && code.trim() ? code : null;
}

export type DiffLine = { kind: "add" | "del" | "same"; text: string; oldNo: number | null; newNo: number | null };

/** Line diff between the current buffer and a proposed version, with line numbers on both sides. */
export function lineDiff(before: string, after: string): { lines: DiffLine[]; added: number; removed: number } {
  const lines: DiffLine[] = [];
  let oldNo = 1;
  let newNo = 1;
  let added = 0;
  let removed = 0;
  for (const part of diffLines(before.replace(/\n?$/, "\n"), after.replace(/\n?$/, "\n"))) {
    const texts = part.value.replace(/\n$/, "").split("\n");
    for (const text of texts) {
      if (part.added) {
        lines.push({ kind: "add", text, oldNo: null, newNo: newNo++ });
        added++;
      } else if (part.removed) {
        lines.push({ kind: "del", text, oldNo: oldNo++, newNo: null });
        removed++;
      } else lines.push({ kind: "same", text, oldNo: oldNo++, newNo: newNo++ });
    }
  }
  return { lines, added, removed };
}
