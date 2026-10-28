"use client";
import type { HighlighterCore, ShikiTransformer } from "shiki/core";

const LANG_IMPORTS: Record<string, () => Promise<unknown>> = {
  typescript: () => import("@shikijs/langs/typescript"),
  tsx: () => import("@shikijs/langs/tsx"),
  javascript: () => import("@shikijs/langs/javascript"),
  jsx: () => import("@shikijs/langs/jsx"),
  python: () => import("@shikijs/langs/python"),
  java: () => import("@shikijs/langs/java"),
  c: () => import("@shikijs/langs/c"),
  cpp: () => import("@shikijs/langs/cpp"),
  markdown: () => import("@shikijs/langs/markdown"),
  json: () => import("@shikijs/langs/json"),
  yaml: () => import("@shikijs/langs/yaml"),
  toml: () => import("@shikijs/langs/toml"),
  css: () => import("@shikijs/langs/css"),
  html: () => import("@shikijs/langs/html"),
  bash: () => import("@shikijs/langs/bash"),
  go: () => import("@shikijs/langs/go"),
  rust: () => import("@shikijs/langs/rust"),
  sql: () => import("@shikijs/langs/sql"),
};

export function shikiLang(path: string, language: string | null): string | null {
  const ext = path.split(".").pop()?.toLowerCase();
  if (ext === "tsx") return "tsx";
  if (ext === "jsx") return "jsx";
  const map: Record<string, string> = { shell: "bash", scss: "css" };
  const l = language ? (map[language] ?? language) : null;
  return l && LANG_IMPORTS[l] ? l : null;
}

let highlighter: Promise<HighlighterCore> | null = null;
const loaded = new Set<string>();

async function getHighlighter() {
  highlighter ??= (async () => {
    const [{ createHighlighterCore }, { createJavaScriptRegexEngine }, dark, light] = await Promise.all([
      import("shiki/core"),
      import("shiki/engine/javascript"),
      import("@shikijs/themes/github-dark-default"),
      import("@shikijs/themes/github-light-default"),
    ]);
    return createHighlighterCore({ themes: [dark.default, light.default], langs: [], engine: createJavaScriptRegexEngine({ forgiving: true }) });
  })();
  return highlighter;
}

export const MAX_HIGHLIGHT_LINES = 6000;

/** Returns Shiki HTML (escaped by Shiki) with one `.line` element per source line. */
export async function highlight(code: string, lang: string | null, range?: { start: number; end: number }): Promise<string> {
  const h = await getHighlighter();
  const useLang = lang && code.split("\n").length <= MAX_HIGHLIGHT_LINES ? lang : "text";
  if (useLang !== "text" && !loaded.has(useLang)) {
    const mod = (await LANG_IMPORTS[useLang]()) as { default: Parameters<HighlighterCore["loadLanguage"]>[0] };
    await h.loadLanguage(mod.default);
    loaded.add(useLang);
  }
  const transformer: ShikiTransformer = {
    line(node, line) {
      node.properties["data-line"] = line;
      if (range && line >= range.start && line <= range.end) this.addClassToHast(node, "is-highlighted");
    },
  };
  return h.codeToHtml(code, { lang: useLang, themes: { dark: "github-dark-default", light: "github-light-default" }, defaultColor: false, transformers: [transformer] });
}
