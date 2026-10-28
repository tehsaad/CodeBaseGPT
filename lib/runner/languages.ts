export type RunLanguage = "python" | "javascript" | "typescript" | "c" | "cpp" | "java";

export type LanguageSpec = {
  id: RunLanguage;
  label: string;
  /** Needs the toolchain snapshot (gcc/g++/JDK). */
  compiled: boolean;
  fileName: (code: string) => string;
  compile?: (file: string) => string;
  run: (file: string) => string;
};

/** Java requires the file name to match the public class. */
function javaFile(code: string) {
  const m = code.match(/public\s+(?:final\s+|abstract\s+)*class\s+([A-Za-z_]\w*)/);
  return `${m?.[1] ?? "Main"}.java`;
}

export const LANGUAGES: Record<RunLanguage, LanguageSpec> = {
  python: { id: "python", label: "Python 3.14", compiled: false, fileName: () => "main.py", run: (f) => `python3 -u ${f}` },
  javascript: { id: "javascript", label: "JavaScript (Node 24)", compiled: false, fileName: () => "main.mjs", run: (f) => `node ${f}` },
  typescript: { id: "typescript", label: "TypeScript (Node 24)", compiled: false, fileName: () => "main.ts", run: (f) => `node --no-warnings ${f}` },
  c: { id: "c", label: "C (gcc 15, C17)", compiled: true, fileName: () => "main.c", compile: (f) => `gcc -std=c17 -O0 -g -Wall -Wextra -o prog ${f} -lm`, run: () => "./prog" },
  cpp: { id: "cpp", label: "C++ (g++ 15, C++20)", compiled: true, fileName: () => "main.cpp", compile: (f) => `g++ -std=c++20 -O0 -g -Wall -Wextra -o prog ${f}`, run: () => "./prog" },
  java: { id: "java", label: "Java 25", compiled: true, fileName: javaFile, compile: (f) => `javac -Xlint:all ${f}`, run: (f) => `java -Xss8m -Xmx256m ${f.replace(/\.java$/, "")}` },
};

export const RUN_LANGUAGES = Object.keys(LANGUAGES) as RunLanguage[];

/** Maps an indexed repository file's language to a runnable language, if any. */
export function runLanguageFor(path: string, language: string | null): RunLanguage | null {
  if (/\.tsx?$/.test(path)) return "typescript";
  if (/\.(m|c)?jsx?$/.test(path)) return "javascript";
  if (/\.(cc|cpp|cxx|hpp)$/.test(path)) return "cpp";
  if (/\.c$/.test(path)) return "c";
  if (language === "python" || language === "java") return language;
  return null;
}

const SIGNALS: Record<number, string> = {
  4: "SIGILL — illegal instruction",
  6: "SIGABRT — the program aborted (often a failed assert or a memory-corruption check)",
  8: "SIGFPE — arithmetic error, usually integer division by zero",
  9: "SIGKILL — killed (time or memory limit)",
  11: "SIGSEGV — segmentation fault: the program read or wrote memory it doesn't own (null/dangling pointer, out-of-bounds index)",
};

/** Human explanation of a process exit code. */
export function describeExit(exitCode: number | null, timedOut: boolean): string | null {
  if (timedOut) return "Stopped after the time limit — this usually means an infinite loop or a program waiting for input that never came.";
  if (exitCode === null || exitCode === 0) return null;
  if (exitCode > 128 && SIGNALS[exitCode - 128]) return `Exit code ${exitCode}: ${SIGNALS[exitCode - 128]}.`;
  return `Exit code ${exitCode}: the program reported a failure.`;
}
