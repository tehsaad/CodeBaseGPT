export type ParsedLanguage = "typescript" | "tsx" | "javascript" | "python" | "java" | "c" | "cpp";

/** Languages with full Tree-sitter symbol + import extraction. */
export const PARSED_LANGUAGES: Record<string, ParsedLanguage> = {
  ".ts": "typescript",
  ".mts": "typescript",
  ".cts": "typescript",
  ".tsx": "tsx",
  ".js": "javascript",
  ".jsx": "javascript",
  ".mjs": "javascript",
  ".cjs": "javascript",
  ".py": "python",
  ".pyi": "python",
  ".java": "java",
  ".c": "c",
  ".h": "c",
  ".cc": "cpp",
  ".cpp": "cpp",
  ".cxx": "cpp",
  ".hpp": "cpp",
  ".hh": "cpp",
  ".hxx": "cpp",
};

/** Text files we index for search and source viewing, but don't extract symbols from. */
export const TEXT_LANGUAGES: Record<string, string> = {
  ".md": "markdown",
  ".mdx": "markdown",
  ".txt": "text",
  ".json": "json",
  ".yaml": "yaml",
  ".yml": "yaml",
  ".toml": "toml",
  ".xml": "xml",
  ".html": "html",
  ".css": "css",
  ".scss": "scss",
  ".sql": "sql",
  ".sh": "shell",
  ".go": "go",
  ".rs": "rust",
  ".rb": "ruby",
  ".php": "php",
  ".cs": "csharp",
  ".kt": "kotlin",
  ".swift": "swift",
  ".vue": "vue",
  ".svelte": "svelte",
  ".gradle": "gradle",
  ".prisma": "prisma",
  ".graphql": "graphql",
};

const SPECIAL_FILES: Record<string, string> = {
  dockerfile: "dockerfile",
  makefile: "makefile",
  "cmakelists.txt": "cmake",
  "readme": "text",
  license: "text",
};

/** Display language used for stats; `.h` files are counted as C/C++ headers. */
export function detectLanguage(path: string): { language: string | null; parsed: ParsedLanguage | null } {
  const base = path.split("/").pop()!.toLowerCase();
  const dot = base.lastIndexOf(".");
  const ext = dot >= 0 ? base.slice(dot) : "";
  if (PARSED_LANGUAGES[ext]) {
    const parsed = PARSED_LANGUAGES[ext];
    return { language: parsed === "tsx" ? "typescript" : parsed, parsed };
  }
  if (TEXT_LANGUAGES[ext]) return { language: TEXT_LANGUAGES[ext], parsed: null };
  if (SPECIAL_FILES[base]) return { language: SPECIAL_FILES[base], parsed: null };
  return { language: null, parsed: null };
}

export const LANGUAGE_LABELS: Record<string, string> = {
  typescript: "TypeScript",
  javascript: "JavaScript",
  python: "Python",
  java: "Java",
  c: "C",
  cpp: "C++",
  markdown: "Markdown",
  json: "JSON",
  yaml: "YAML",
};

export function languageLabel(lang: string | null | undefined) {
  if (!lang) return "Other";
  return LANGUAGE_LABELS[lang] ?? lang.charAt(0).toUpperCase() + lang.slice(1);
}
