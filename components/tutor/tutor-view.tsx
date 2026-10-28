"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertTriangle, CheckCircle2, Clock, GraduationCap, Play, Send, Sparkles, Terminal, XCircle } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import type { CbgUIMessage } from "@/lib/ai/types";
import { api, ClientApiError, fetcher } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { LANGUAGES, RUN_LANGUAGES, runLanguageFor, type RunLanguage } from "@/lib/runner/languages";
import { Button } from "@/components/ui/button";
import { Input, Textarea } from "@/components/ui/field";
import { Badge, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { partsOf } from "@/components/chat/message-parts";
import { ThinkingIndicator } from "@/components/chat/thinking";
import { useProviderStatus } from "@/components/chat/use-status";
import { CodeEditor, type CodeEditorHandle } from "./code-editor";
import { EXAMPLES } from "./examples";
import { TutorMarkdown } from "./tutor-markdown";

type RunResult = {
  id: string;
  language: RunLanguage;
  phase: "compile" | "run";
  compileOutput: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  truncated: boolean;
  durationMs: number | null;
  exitExplanation: string | null;
};

type Level = "beginner" | "intermediate" | "advanced";

function RunStatus({ run }: { run: RunResult }) {
  const ok = run.phase === "run" && run.exitCode === 0 && !run.timedOut;
  const Icon = run.timedOut ? Clock : ok ? CheckCircle2 : run.phase === "compile" ? AlertTriangle : XCircle;
  const tone = ok ? "text-success" : run.timedOut ? "text-warning" : "text-danger";
  const label = run.timedOut ? "Time limit reached" : run.phase === "compile" ? "Didn't compile" : ok ? "Ran successfully" : "Crashed with an error";
  return (
    <div className="flex flex-wrap items-center gap-2 text-[13px]">
      <Icon className={cn("size-4", tone)} aria-hidden />
      <span className={cn("font-medium", tone)}>{label}</span>
      {run.exitCode !== null ? <Badge>exit {run.exitCode}</Badge> : null}
      {run.durationMs !== null && run.phase === "run" ? <Badge>{run.durationMs} ms</Badge> : null}
      {run.truncated ? <Badge tone="warning">output truncated</Badge> : null}
    </div>
  );
}

function Stream({ label, text, tone }: { label: string; text: string; tone?: "danger" }) {
  if (!text) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{label}</p>
      <pre className={cn("max-h-72 overflow-auto rounded-md border border-border bg-code p-3 font-mono text-[12.5px] leading-relaxed whitespace-pre-wrap break-words", tone === "danger" ? "text-danger" : "text-fg")}>{text}</pre>
    </div>
  );
}

export function TutorView() {
  const params = useSearchParams();
  const { data: status } = useProviderStatus();
  const [language, setLanguage] = useState<RunLanguage>("python");
  const [code, setCode] = useState(EXAMPLES.python[0].code);
  const [stdin, setStdin] = useState("");
  const [showStdin, setShowStdin] = useState(false);
  const [running, setRunning] = useState(false);
  const [run, setRun] = useState<RunResult | null>(null);
  const [runError, setRunError] = useState<string | null>(null);
  const [level, setLevel] = useState<Level>("beginner");
  const [question, setQuestion] = useState("");
  const editor = useRef<CodeEditorHandle>(null);

  // "Run in Code Tutor" from the source viewer: load that file into the editor.
  const repoId = params.get("repo");
  const fileId = params.get("file");
  const { data: file } = useSWR<{ file: { path: string; language: string | null; content: string } }>(repoId && fileId ? `/api/repos/${repoId}/files/${fileId}` : null, fetcher);
  const loadedFile = useRef<string | null>(null);
  useEffect(() => {
    if (!file || loadedFile.current === fileId) return;
    loadedFile.current = fileId;
    const lang = runLanguageFor(file.file.path, file.file.language);
    if (lang) setLanguage(lang); // eslint-disable-line react-hooks/set-state-in-effect
    setCode(file.file.content.split("\n").slice(0, 400).join("\n"));
    setRun(null);
  }, [file, fileId]);

  const { messages, sendMessage, status: tutorStatus, setMessages, stop } = useChat<CbgUIMessage>({
    id: "code-tutor",
    transport: new DefaultChatTransport({
      prepareSendMessagesRequest: ({ body }) => {
        const b = (body ?? {}) as { runId?: string; level?: Level; question?: string };
        return { api: `/api/run/${b.runId}/tutor`, body: { level: b.level, question: b.question } };
      },
    }),
  });
  const tutorBusy = tutorStatus === "submitted" || tutorStatus === "streaming";

  async function execute() {
    if (running || !code.trim()) return;
    setRunning(true);
    setRunError(null);
    setMessages([]);
    try {
      setRun(await api<RunResult>("/api/run", { method: "POST", body: JSON.stringify({ language, code, stdin }) }));
    } catch (e) {
      setRunError(e instanceof ClientApiError ? e.message : "The run failed. Try again.");
    } finally {
      setRunning(false);
    }
  }

  function ask(e?: FormEvent, preset?: string) {
    e?.preventDefault();
    if (!run || tutorBusy) return;
    const q = preset ?? question.trim();
    const text = q || (failed ? "Explain my error" : "Review my code");
    sendMessage({ text }, { body: { runId: run.id, level, question: q || undefined } });
    setQuestion("");
  }

  const failed = run ? run.timedOut || run.phase === "compile" || run.exitCode !== 0 : false;
  const spec = LANGUAGES[language];
  const unavailable = status && (!status.runner?.configured || (spec.compiled && !status.runner?.compiledLanguages));

  return (
    <div className="grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)] xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)]">
      <section className="flex min-h-[70dvh] flex-col border-b border-border xl:min-h-0 xl:border-b-0 xl:border-r" aria-label="Your program">
        <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
          <label className="sr-only" htmlFor="tutor-lang">Language</label>
          <select id="tutor-lang" value={language} onChange={(e) => { const l = e.target.value as RunLanguage; setLanguage(l); setCode(EXAMPLES[l][0].code); setStdin(EXAMPLES[l][0].stdin ?? ""); setRun(null); setMessages([]); }} className="h-9 cursor-pointer rounded-md border border-border-strong bg-surface-2 px-2 text-[13px] max-md:h-11">
            {RUN_LANGUAGES.map((l) => <option key={l} value={l}>{LANGUAGES[l].label}</option>)}
          </select>
          <label className="sr-only" htmlFor="tutor-example">Load an example</label>
          <select id="tutor-example" value="" onChange={(e) => { const ex = EXAMPLES[language][Number(e.target.value)]; if (ex) { setCode(ex.code); setStdin(ex.stdin ?? ""); setShowStdin(Boolean(ex.stdin)); setRun(null); setMessages([]); } }} className="h-9 min-w-0 max-w-56 cursor-pointer rounded-md border border-border-strong bg-surface-2 px-2 text-[13px] max-md:h-11">
            <option value="">Load a buggy example…</option>
            {EXAMPLES[language].map((ex, i) => <option key={ex.title} value={i}>{ex.title}</option>)}
          </select>
          <Button size="sm" variant="ghost" onClick={() => setShowStdin((s) => !s)} aria-expanded={showStdin}><Terminal /> Input</Button>
          <Button className="ml-auto" variant="primary" onClick={execute} loading={running} disabled={Boolean(unavailable)} title="Run (Ctrl+Enter)"><Play /> Run</Button>
        </div>
        {file ? <p className="border-b border-border px-4 py-1.5 font-mono text-xs text-fg-muted">Loaded from {file.file.path}</p> : null}
        <div
          className="min-h-[320px] flex-1 overflow-hidden"
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
              e.preventDefault();
              void execute();
            }
          }}
        >
          <CodeEditor ref={editor} value={code} onChange={setCode} language={language} label={`${spec.label} source code`} />
        </div>
        {showStdin ? (
          <div className="border-t border-border p-3">
            <label htmlFor="tutor-stdin" className="mb-1 block text-[12px] font-medium">Program input (stdin)</label>
            <Textarea id="tutor-stdin" value={stdin} onChange={(e) => setStdin(e.target.value)} rows={3} className="font-mono text-[12.5px]" placeholder="Each line is read by input() / Scanner / cin…" />
          </div>
        ) : null}
        <p className="border-t border-border px-4 py-2 text-[11px] text-fg-subtle">Runs in an isolated Vercel Sandbox microVM: no network, 10 s time limit, 64 KB output. Ctrl+Enter to run.</p>
      </section>

      <section className="min-w-0 space-y-4 overflow-auto p-4 sm:p-6" aria-label="Output and tutor">
        {unavailable ? (
          <Notice tone="warning" title="This language can't run on this server yet">
            {!status?.runner?.configured ? "The sandbox runner isn't configured." : `${spec.label} needs the compiler snapshot (SANDBOX_SNAPSHOT_ID). Python, JavaScript and TypeScript work.`}
          </Notice>
        ) : null}
        <Panel className="p-4">
          <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold"><Terminal className="size-4 text-primary" aria-hidden /> Output</h2>
          {running ? (
            <div className="space-y-2" role="status"><p className="text-[13px] text-fg-muted">Starting a sandbox and running your program…</p><Skeleton className="h-20" /></div>
          ) : runError ? (
            <Notice tone="danger" title={runError} />
          ) : run ? (
            <div className="space-y-3">
              <RunStatus run={run} />
              {run.exitExplanation ? <p className="text-[13px] text-fg-muted">{run.exitExplanation}</p> : null}
              <Stream label="Compiler" text={run.compileOutput} tone={run.phase === "compile" ? "danger" : undefined} />
              {run.phase === "run" ? <Stream label="Output (stdout)" text={run.stdout || (run.stderr ? "" : "(no output)")} /> : null}
              <Stream label="Errors (stderr)" text={run.stderr} tone="danger" />
            </div>
          ) : (
            <p className="text-[13px] text-fg-muted">Write or load a program, then press <span className="font-medium text-fg">Run</span>. You&apos;ll see exactly what it printed, and the tutor can explain any error.</p>
          )}
        </Panel>

        {run ? (
          <Panel className="p-4">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold"><GraduationCap className="size-4 text-accent" aria-hidden /> Tutor</h2>
              <label className="ml-auto text-[12px] text-fg-muted">
                Explain for{" "}
                <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className="ml-1 h-8 cursor-pointer rounded-md border border-border-strong bg-surface-2 px-2 text-[12.5px] text-fg">
                  <option value="beginner">a beginner</option>
                  <option value="intermediate">intermediate</option>
                  <option value="advanced">advanced</option>
                </select>
              </label>
            </div>
            {messages.length === 0 ? (
              <div className="flex flex-wrap gap-2">
                <Button variant="primary" onClick={() => ask()} disabled={tutorBusy}><Sparkles /> {failed ? "Explain my error" : "Review my code"}</Button>
                {failed ? <Button onClick={() => ask(undefined, "Give me only a hint, not the answer.")}>Just a hint</Button> : <Button onClick={() => ask(undefined, "What inputs would break this program?")}>What inputs break it?</Button>}
              </div>
            ) : null}
            <div className="space-y-4">
              {messages.map((m) => {
                if (m.role === "user") return <p key={m.id} className="ml-auto w-fit max-w-[85%] rounded-xl rounded-br-sm bg-surface-3 px-3 py-1.5 text-[13.5px]">{m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}</p>;
                const p = partsOf(m);
                const streaming = tutorBusy && m === messages[messages.length - 1];
                return (
                  <article key={m.id} className="space-y-2">
                    {p.meta?.model ? <p className="text-[11px] text-fg-subtle">AI tutor · {p.meta.model} · grounded in the real run above</p> : null}
                    {p.status ? <Notice tone="danger" title={p.status.message} /> : null}
                    {streaming && (!p.text || p.progress?.phase !== "writing") ? <ThinkingIndicator progress={p.progress} /> : null}
                    {p.text ? <TutorMarkdown text={p.text} onLine={(a, b) => editor.current?.flashLines(a, b)} /> : null}
                  </article>
                );
              })}
            </div>
            {messages.length > 0 ? (
              <form onSubmit={ask} className="mt-4 flex gap-2">
                <Input value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Ask a follow-up about this run…" aria-label="Follow-up question" maxLength={2000} />
                {tutorBusy ? <Button type="button" onClick={() => stop()}>Stop</Button> : <Button type="submit" variant="primary" size="icon" aria-label="Ask the tutor" disabled={!question.trim()}><Send /></Button>}
              </form>
            ) : null}
          </Panel>
        ) : null}
      </section>
    </div>
  );
}
