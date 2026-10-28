import "server-only";
import { Sandbox } from "@vercel/sandbox";
import { env, sandboxStatus } from "@/lib/env";
import { log } from "@/lib/observability/log";
import { LANGUAGES, type RunLanguage } from "./languages";

export const RUN_LIMITS = { codeChars: 20_000, stdinChars: 10_000, outputBytes: 64 * 1024, compileSeconds: 30, runSeconds: 10 } as const;

export type RunResult = {
  language: RunLanguage;
  phase: "compile" | "run";
  compileOutput: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number | null;
};

export class RunnerUnavailableError extends Error {}

type Runner = (language: RunLanguage, code: string, stdin: string) => Promise<RunResult>;
let override: Runner | null = null;

export function setRunnerOverrideForTests(fn: Runner | null) {
  override = fn;
}

const DIR = "/vercel/sandbox";

/**
 * Runs untrusted student code in a throwaway Vercel Sandbox microVM: 1 vCPU, no network,
 * hard time limits, output capped, and the VM is always stopped afterwards. Nothing runs in
 * the app's own function.
 */
export async function runProgram(language: RunLanguage, code: string, stdin: string): Promise<RunResult> {
  if (override) return override(language, code, stdin);
  const spec = LANGUAGES[language];
  const status = sandboxStatus();
  if (!status.configured) throw new RunnerUnavailableError("The code runner isn't configured on this server (Vercel Sandbox credentials are missing).");
  const snapshotId = env().SANDBOX_SNAPSHOT_ID;
  if (spec.compiled && !snapshotId) throw new RunnerUnavailableError(`${spec.label} needs the compiler snapshot (SANDBOX_SNAPSHOT_ID). Python, JavaScript and TypeScript still work.`);

  const file = spec.fileName(code);
  const cap = RUN_LIMITS.outputBytes;
  // stdout/stderr are capped with head; PIPESTATUS keeps the program's real exit code.
  const script = [
    "set -u",
    `cd ${DIR}`,
    spec.compile
      ? `timeout -k 2 ${RUN_LIMITS.compileSeconds} ${spec.compile(file)} > compile.txt 2>&1; c=$?; echo $c > compile.code; if [ $c -ne 0 ]; then exit 0; fi`
      : "echo 0 > compile.code",
    `s=$(date +%s%N); timeout -k 1 ${RUN_LIMITS.runSeconds} ${spec.run(file)} < stdin.txt 2> >(head -c ${cap} > stderr.txt) | head -c ${cap} > stdout.txt; echo \${PIPESTATUS[0]} > run.code; e=$(date +%s%N); echo $(( (e - s) / 1000000 )) > run.ms; sleep 0.2`,
  ].join("\n");

  const started = Date.now();
  const base = { resources: { vcpus: 1 }, timeout: 90_000, persistent: false, networkPolicy: "deny-all" } as const;
  const sandbox = snapshotId ? await Sandbox.create({ ...base, source: { type: "snapshot", snapshotId } }) : await Sandbox.create(base);
  try {
    await sandbox.writeFiles([
      { path: `${DIR}/${file}`, content: Buffer.from(code) },
      { path: `${DIR}/stdin.txt`, content: Buffer.from(stdin) },
      { path: `${DIR}/run.sh`, content: Buffer.from(script) },
    ]);
    await sandbox.runCommand("bash", [`${DIR}/run.sh`]);
    const read = async (name: string) => (await sandbox.readFileToBuffer({ path: `${DIR}/${name}` }))?.toString("utf8") ?? "";
    const [compileOutput, compileCode, stdout, stderr, runCode, ms] = await Promise.all(["compile.txt", "compile.code", "stdout.txt", "stderr.txt", "run.code", "run.ms"].map(read));
    const compileFailed = Number(compileCode.trim()) !== 0;
    const exit = runCode.trim() === "" ? null : Number(runCode.trim());
    const result: RunResult = {
      language,
      phase: compileFailed ? "compile" : "run",
      compileOutput: compileOutput.slice(0, cap),
      stdout,
      stderr,
      exitCode: compileFailed ? Number(compileCode.trim()) : exit,
      timedOut: compileFailed ? Number(compileCode.trim()) === 124 : exit === 124 || exit === 137,
      truncated: stdout.length >= cap || stderr.length >= cap,
      durationMs: ms.trim() ? Number(ms.trim()) : null,
    };
    log("info", "runner.done", { language, phase: result.phase, exitCode: result.exitCode, timedOut: result.timedOut, ms: Date.now() - started });
    return result;
  } finally {
    await sandbox.stop().catch(() => {});
  }
}
