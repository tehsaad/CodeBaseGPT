export type SearchContext = { problem: string; errorText?: string; languages: string[]; frameworks: string[] };

const ERROR_LINE = [
  /\b(ModuleNotFoundError|ImportError):\s*.+/,
  /\b[A-Z][A-Za-z]*(?:Error|Exception)\b(?::\s*.+)?/,
  /\berror\s+TS\d{3,5}:\s*.+/i,
  /\bCannot find module\s+['"][^'"]+['"]/,
  /\bundefined reference to\s+.+/,
  /\bsegmentation fault\b/i,
  /\bnpm ERR!\s*.+/,
];

/** Picks the most informative error line and strips machine-specific noise (paths, line numbers, addresses). */
export function extractErrorSignature(text: string | undefined): string | null {
  if (!text) return null;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  for (const re of ERROR_LINE) {
    for (const line of lines) {
      const m = line.match(re);
      if (m) return normalize(m[0]);
    }
  }
  return lines.length ? normalize(lines[lines.length - 1]) : null;
}

function normalize(s: string) {
  return s
    // Never send URLs, emails or token-like strings from a student's error to a search provider.
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, " ")
    .replace(/\b[\w.+-]+@[\w-]+\.[\w.-]+\b/g, " ")
    .replace(/\b[A-Za-z0-9_\-]{32,}\b/g, " ")
    .replace(/(?:[A-Za-z]:)?(?:[\\/][\w.@-]+){2,}[\\/]?/g, " ")
    .replace(/:\d+(:\d+)?/g, "")
    .replace(/\b0x[0-9a-f]+\b/gi, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

/** Deterministic, editable search suggestions (the student sees exactly what will be searched). */
export function suggestQueries(ctx: SearchContext): string[] {
  const sig = extractErrorSignature(ctx.errorText);
  const lang = ctx.languages[0];
  const fw = ctx.frameworks[0]?.split(" ")[0];
  const topic = ctx.problem.replace(/\s+/g, " ").trim().slice(0, 120);
  const out = new Set<string>();
  if (sig) out.add([sig, fw ?? lang].filter(Boolean).join(" "));
  if (sig && lang) out.add(`${sig} ${lang} fix`);
  if (topic) out.add([fw ?? lang, topic].filter(Boolean).join(" "));
  if (fw && topic) out.add(`${fw} official documentation ${topic}`.slice(0, 200));
  if (!out.size && topic) out.add(topic);
  return [...out].filter((q) => q.length >= 3).slice(0, 4);
}

/** Function names from stack frames (JS/TS "at fn (", Python 'in fn', Java "at pkg.Class.fn("), used as retrieval hints. */
export function stackFrameSymbols(text: string | undefined): string[] {
  if (!text) return [];
  const out = new Set<string>();
  for (const m of text.matchAll(/\bat\s+(?:async\s+)?(?:new\s+)?([A-Za-z_$][\w$.]*)\s*\(/g)) out.add(m[1].split(".").pop()!);
  for (const m of text.matchAll(/File "[^"]+", line \d+, in ([A-Za-z_]\w*)/g)) out.add(m[1]);
  out.delete("Object");
  out.delete("Module");
  out.delete("<module>");
  return [...out].filter((n) => n.length >= 3).slice(0, 6);
}
