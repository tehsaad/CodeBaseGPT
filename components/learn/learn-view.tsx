"use client";
import { ArrowRight, BookOpenText, CheckCircle2, Circle, Code2, GitFork, MessageSquareText, Network, Play, Route } from "lucide-react";
import useSWR from "swr";
import { api, fetcher, type ClientApiError } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { useRepo } from "@/components/repos/repo-context";
import { useSourceDrawer } from "@/components/source/source-drawer";

type Task = { id: string; kind: "read" | "trace" | "explore" | "ask" | "run"; title: string; why: string; fileId?: string; path?: string; line?: number | null; chain?: { fileId: string; path: string }[]; question?: string };
type Stage = { id: string; title: string; goal: string; tasks: Task[] };

const ICON = { read: BookOpenText, trace: Route, explore: Network, ask: MessageSquareText, run: Play };

export function LearnView() {
  const { repo } = useRepo();
  const { openSource } = useSourceDrawer();
  const { data, error, mutate } = useSWR<{ stages: Stage[]; completed: string[] }, ClientApiError>(`/api/repos/${repo.id}/learning`, fetcher, { revalidateOnFocus: false });
  const done = new Set(data?.completed ?? []);
  const total = data?.stages.reduce((n, s) => n + s.tasks.length, 0) ?? 0;
  const toggle = async (t: Task) => {
    const next = !done.has(t.id);
    await mutate(async (cur) => {
      await api(`/api/repos/${repo.id}/learning`, { method: "POST", body: JSON.stringify({ taskId: t.id, done: next }) });
      return cur && { ...cur, completed: next ? [...cur.completed, t.id] : cur.completed.filter((x) => x !== t.id) };
    }, { optimisticData: (cur) => cur! && { ...cur, completed: next ? [...cur.completed, t.id] : cur.completed.filter((x) => x !== t.id) }, revalidate: false });
  };
  const base = `/repos/${repo.id}`;
  const action = (t: Task) => {
    switch (t.kind) {
      case "read":
        return <Button size="sm" onClick={() => openSource({ fileId: t.fileId!, startLine: t.line ?? undefined, endLine: t.line ?? undefined, title: t.path })}><Code2 /> Open</Button>;
      case "explore":
        return t.fileId ? <ButtonLink size="sm" href={`${base}/impact?file=${t.fileId}`}><GitFork /> Impact</ButtonLink> : <ButtonLink size="sm" href={`${base}/atlas`}><Network /> Atlas</ButtonLink>;
      case "ask":
        return <ButtonLink size="sm" href={`${base}/ask?${t.fileId ? `file=${t.fileId}&` : ""}q=${encodeURIComponent(t.question ?? "")}`}><MessageSquareText /> Ask</ButtonLink>;
      case "run":
        return <ButtonLink size="sm" href={`/tutor?repo=${repo.id}&file=${t.fileId}`}><Play /> Run</ButtonLink>;
      case "trace":
        return <ButtonLink size="sm" href={`${base}/atlas?mode=dependencies&node=${encodeURIComponent(`file:${t.path}`)}`}><Route /> In Atlas</ButtonLink>;
    }
  };

  return (
    <div className="mx-auto w-full max-w-4xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold"><BookOpenText className="size-5 text-primary" aria-hidden /> Learning path</h1>
          <p className="text-[13px] text-fg-muted">A route through this repository built from its real structure: start at the README, find the entry points, learn the core, then trace and practise.</p>
        </div>
        {data ? <div className="text-right"><p className="font-mono text-sm">{done.size} / {total}</p><p className="text-[11px] text-fg-muted">tasks done</p></div> : null}
      </div>
      {data ? <div className="h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Learning progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done.size}><div className="h-full bg-primary transition-[width]" style={{ width: `${total ? (done.size / total) * 100 : 0}%` }} /></div> : null}
      {error ? <Notice tone="danger" title="Couldn't build the learning path">{error.message}</Notice> : null}
      {!data && !error ? <Skeleton className="h-96" /> : null}
      {data?.stages.map((s) => (
        <Panel key={s.id} className="p-4" as="section">
          <h2 className="text-sm font-semibold">{s.title}</h2>
          <p className="text-xs text-fg-muted">{s.goal}</p>
          <ol className="mt-3 space-y-2">
            {s.tasks.map((t) => {
              const Icon = ICON[t.kind];
              const isDone = done.has(t.id);
              return (
                <li key={t.id} className={cn("flex flex-wrap items-start gap-3 rounded-lg border border-border p-3", isDone && "bg-surface-2/60")}>
                  <button type="button" onClick={() => void toggle(t)} aria-pressed={isDone} aria-label={`${isDone ? "Mark not done" : "Mark done"}: ${t.title}`} className="mt-0.5 cursor-pointer text-fg-muted hover:text-primary">
                    {isDone ? <CheckCircle2 className="size-5 text-success" /> : <Circle className="size-5" />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={cn("flex items-center gap-1.5 text-[13.5px] font-medium", isDone && "text-fg-muted line-through")}><Icon className="size-3.5 shrink-0 text-primary" aria-hidden /> <span className="break-all">{t.title}</span></p>
                    <p className="text-xs text-fg-muted">{t.why}</p>
                    {t.chain ? (
                      <p className="mt-1 flex flex-wrap items-center gap-1 font-mono text-[11.5px] text-fg-muted">
                        {t.chain.map((c, i) => <span key={c.fileId} className="flex items-center gap-1"><button type="button" className="cursor-pointer hover:text-primary" onClick={() => openSource({ fileId: c.fileId, title: c.path })}>{c.path}</button>{i < t.chain!.length - 1 ? <ArrowRight className="size-3" aria-hidden /> : null}</span>)}
                      </p>
                    ) : null}
                  </div>
                  <div className="shrink-0">{action(t)}</div>
                </li>
              );
            })}
          </ol>
        </Panel>
      ))}
      {data ? <p className="flex items-center gap-1.5 text-xs text-fg-subtle"><Badge>from the index</Badge> Every task points at a real file found by static analysis; progress is private to you.</p> : null}
    </div>
  );
}
