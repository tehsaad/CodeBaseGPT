"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { BookOpenText, Compass, FileCode2, GitFork, Network, RefreshCw, Route, Sparkles } from "lucide-react";
import { useMemo } from "react";
import useSWR from "swr";
import { fetcher, type ClientApiError } from "@/lib/client/api";
import { languageLabel } from "@/lib/code-intelligence/languages";
import type { CbgUIMessage, EvidenceItem } from "@/lib/ai/types";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { AnswerMarkdown } from "@/components/chat/answer-markdown";
import { EvidenceList } from "@/components/chat/evidence";
import { partsOf } from "@/components/chat/message-parts";
import { ThinkingIndicator } from "@/components/chat/thinking";
import { useRepo } from "@/components/repos/repo-context";
import { useSourceDrawer } from "@/components/source/source-drawer";

type Facts = {
  repo: { name: string; commit: string | null; files: number; lines: number; symbols: number; skipped: number; frameworks: string[]; ecosystems: string[] };
  languages: [string, number][];
  modules: { path: string; files: number; lines: number }[];
  hubs: { fileId: string; path: string; importers: number }[];
  entries: { fileId: string; path: string; line: number | null; why: string }[];
  routes: { fileId: string; path: string }[];
  readme: { fileId: string; path: string } | null;
};
type Stored = { content: string; evidence: { label: string; fileId: string; path: string; startLine: number; endLine: number; symbol?: string | null }[]; usedLabels: string[]; model: string | null; updatedAt: string; stale: boolean; data: { invalidCitations?: string[] } | null };

export function GuideView() {
  const { repo } = useRepo();
  const { openSource } = useSourceDrawer();
  const { data, error, mutate } = useSWR<{ facts: Facts; guide: Stored | null }, ClientApiError>(`/api/repos/${repo.id}/guide`, fetcher, { revalidateOnFocus: false });
  const { messages, sendMessage, status, setMessages } = useChat<CbgUIMessage>({
    id: `guide-${repo.id}`,
    transport: new DefaultChatTransport({ api: `/api/repos/${repo.id}/guide`, prepareSendMessagesRequest: () => ({ body: {} }) }),
    onFinish: () => void mutate(),
  });
  const busy = status === "submitted" || status === "streaming";
  const live = messages.findLast((m) => m.role === "assistant");
  const lp = live ? partsOf(live) : null;

  // Prefer the live stream; otherwise show the cached guide.
  const guide = useMemo(() => {
    if (lp && (busy || lp.text || lp.status)) return { text: lp.text, evidence: lp.evidence, used: new Set(lp.citations?.used ?? []), model: lp.meta?.model ?? null, status: lp.status, progress: lp.progress, stale: false, updatedAt: null as string | null };
    if (!data?.guide) return null;
    const g = data.guide;
    const evidence: EvidenceItem[] = g.evidence.map((e) => ({ ...e, symbol: e.symbol ?? null, reason: "overview", language: null, preview: "" }));
    return { text: g.content, evidence, used: new Set(g.usedLabels), model: g.model, status: null, progress: null, stale: g.stale, updatedAt: g.updatedAt };
  }, [lp, busy, data?.guide]);
  const handlers = useMemo(() => ({ evidence: new Map((guide?.evidence ?? []).map((e) => [e.label, e])), web: new Map(), onOpenEvidence: (e: EvidenceItem) => openSource({ fileId: e.fileId, startLine: e.startLine, endLine: e.endLine, title: `${e.label} · ${e.path}` }) }), [guide?.evidence, openSource]);

  const generate = () => {
    setMessages([]);
    void sendMessage({ text: "guide" });
  };
  const open = (fileId: string, line?: number | null) => openSource({ fileId, startLine: line ?? undefined, endLine: line ?? undefined, title: "Codebase guide" });
  const f = data?.facts;
  const total = f ? f.languages.reduce((s, [, n]) => s + n, 0) || 1 : 1;

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      <div className="min-w-0 space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-lg font-semibold"><Compass className="size-5 text-primary" aria-hidden /> Codebase guide</h1>
            <p className="text-[13px] text-fg-muted">Start here: what this repository is, how it&apos;s organised, and what to read first.</p>
          </div>
          <Button variant={guide ? "secondary" : "primary"} onClick={generate} disabled={busy || !f}>
            {guide ? <RefreshCw /> : <Sparkles />} {busy ? "Writing…" : guide ? "Regenerate" : "Write the guide with Gemma"}
          </Button>
        </div>
        {error ? <Notice tone="danger" title="Couldn't load the guide">{error.message}</Notice> : null}
        {guide?.stale ? <Notice tone="warning" title="This guide predates the latest index" action={<Button size="sm" onClick={generate} disabled={busy}>Regenerate</Button>}>The repository was re-indexed after this guide was written, so some details may have changed.</Notice> : null}
        <Panel className="p-5" as="article">
          {guide ? (
            <>
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-fg-muted">
                <Badge tone="accent">AI-written · cited</Badge>
                {guide.model ? <span>by {guide.model}</span> : null}
                {guide.updatedAt ? <span>· {new Date(guide.updatedAt).toLocaleString()}</span> : null}
                <span>· {guide.used.size} of {guide.evidence.length} sources cited</span>
              </div>
              {guide.status ? <Notice tone={guide.status.kind === "error" ? "danger" : "info"} title={guide.status.message} className="mb-3" /> : null}
              {busy && (!guide.text || guide.progress?.phase !== "writing") ? <ThinkingIndicator progress={guide.progress} /> : null}
              {guide.text ? <AnswerMarkdown text={guide.text.replace(/\s*\[repository_facts\]/g, " _(index)_")} h={handlers} /> : null}
              {!busy && data?.guide?.data?.invalidCitations?.length ? <p className="mt-3 text-xs text-danger">Unverifiable citation labels were removed from links: {data.guide.data.invalidCitations.join(", ")}</p> : null}
            </>
          ) : f ? (
            <div className="space-y-2 text-[13.5px] text-fg-muted">
              <p className="flex items-center gap-2 text-fg"><BookOpenText className="size-4 text-primary" aria-hidden /> No guide yet.</p>
              <p>Gemma will read the README, the entry points and the most depended-on files listed here, then write a short guide where every claim links to the code it came from. The facts on this page come straight from the index and need no AI.</p>
            </div>
          ) : (
            <Skeleton className="h-48" />
          )}
        </Panel>
        {guide?.evidence.length ? (
          <Panel className="p-4">
            <h2 className="mb-2 text-sm font-semibold">Sources Gemma read</h2>
            <EvidenceList items={guide.evidence} used={guide.used} onOpen={handlers.onOpenEvidence} compact />
          </Panel>
        ) : null}
      </div>

      <aside className="min-w-0 space-y-4" aria-label="Repository facts">
        {f ? (
          <>
            <Panel className="p-4">
              <h2 className="text-sm font-semibold">At a glance</h2>
              <p className="mt-0.5 text-[11px] text-fg-subtle">From the index — not AI</p>
              <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[["files", f.repo.files], ["lines", f.repo.lines.toLocaleString()], ["symbols", f.repo.symbols]].map(([k, v]) => <div key={k as string} className="rounded-md border border-border p-1.5"><dd className="font-mono text-sm">{v}</dd><dt className="text-[11px] text-fg-muted">{k}</dt></div>)}
              </dl>
              <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-surface-3" aria-hidden>
                {f.languages.map(([l, n], i) => <span key={l} style={{ width: `${(n / total) * 100}%`, opacity: 1 - i * 0.13 }} className="bg-primary" />)}
              </div>
              <ul className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-fg-muted">{f.languages.map(([l, n]) => <li key={l}>{languageLabel(l)} {Math.round((n / total) * 100)}%</li>)}</ul>
              {f.repo.frameworks.length ? <div className="mt-2 flex flex-wrap gap-1">{f.repo.frameworks.map((x) => <Badge key={x}>{x}</Badge>)}</div> : null}
            </Panel>
            <Panel className="p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold"><Route className="size-4 text-primary" aria-hidden /> Entry points</h2>
              {f.entries.length ? (
                <ul className="mt-2 space-y-1.5">{f.entries.map((e) => <li key={`${e.fileId}-${e.why}`}><button type="button" onClick={() => open(e.fileId, e.line)} className="cursor-pointer break-all text-left font-mono text-[12.5px] hover:text-primary">{e.path}{e.line ? `:${e.line}` : ""}</button><p className="text-[11px] text-fg-subtle">{e.why}</p></li>)}</ul>
              ) : <p className="mt-2 text-[13px] text-fg-muted">No conventional entry point detected — this may be a library.</p>}
            </Panel>
            <Panel className="p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold"><GitFork className="size-4 text-primary" aria-hidden /> Most depended-on</h2>
              <ul className="mt-2 space-y-1">{f.hubs.map((h) => <li key={h.fileId} className="flex items-center gap-2"><button type="button" onClick={() => open(h.fileId)} className="min-w-0 flex-1 cursor-pointer truncate text-left font-mono text-[12.5px] hover:text-primary">{h.path}</button><span className="shrink-0 font-mono text-[11px] text-fg-subtle" title="files that import it">{h.importers}←</span></li>)}</ul>
              {!f.hubs.length ? <p className="mt-2 text-[13px] text-fg-muted">No internal imports were resolved.</p> : null}
            </Panel>
            <Panel className="p-4">
              <h2 className="flex items-center gap-1.5 text-sm font-semibold"><FileCode2 className="size-4 text-primary" aria-hidden /> Modules</h2>
              <ul className="mt-2 space-y-1 text-[12.5px]">{f.modules.map((m) => <li key={m.path} className="flex justify-between gap-2"><span className="truncate font-mono">{m.path}</span><span className="shrink-0 text-fg-subtle">{m.files} files</span></li>)}</ul>
              <div className="mt-3 flex flex-wrap gap-1.5">
                <ButtonLink size="sm" variant="ghost" href={`/repos/${repo.id}/atlas`}><Network /> Atlas</ButtonLink>
                <ButtonLink size="sm" variant="ghost" href={`/repos/${repo.id}/learn`}><BookOpenText /> Learning path</ButtonLink>
              </div>
            </Panel>
          </>
        ) : (
          <Skeleton className="h-96" />
        )}
      </aside>
    </div>
  );
}
