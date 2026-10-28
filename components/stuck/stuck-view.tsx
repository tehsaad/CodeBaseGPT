"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { FileCode2, Globe, LifeBuoy, Search, Sparkles, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState, type FormEvent } from "react";
import type { CbgDataParts, CbgUIMessage, EvidenceItem, WebItem } from "@/lib/ai/types";
import { api, ClientApiError } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { useRepo } from "@/components/repos/repo-context";
import { useSourceDrawer } from "@/components/source/source-drawer";
import { useFileDetail } from "@/components/source/source-viewer";
import { AnswerMarkdown } from "@/components/chat/answer-markdown";
import { EvidenceList, WebList } from "@/components/chat/evidence";
import { partsOf } from "@/components/chat/message-parts";
import { useProviderStatus } from "@/components/chat/use-status";

type Level = "beginner" | "intermediate" | "advanced";
type Plan = { evidence: EvidenceItem[]; queries: string[]; signature: string | null; search: { configured: boolean; provider?: string; missing: string[] } };

function SectionTitle({ icon: Icon, tone, title, note }: { icon: typeof Globe; tone: string; title: string; note?: string }) {
  return (
    <div className="mb-2 flex items-center gap-2">
      <Icon className={cn("size-4", tone)} aria-hidden />
      <h3 className="text-sm font-semibold">{title}</h3>
      {note ? <span className="text-[11px] text-fg-subtle">{note}</span> : null}
    </div>
  );
}

function WebStatus({ web }: { web: CbgDataParts["web"] }) {
  if (web.status === "ok") return web.items.length ? null : <p className="text-[13px] text-fg-muted">The search returned no usable results.</p>;
  if (web.status === "not_configured") return <Notice tone="warning" title="Web search isn't configured">{web.message} The explanation uses repository evidence only.</Notice>;
  if (web.status === "failed") return <Notice tone="danger" title="Web search failed">{web.message}</Notice>;
  return <p className="text-[13px] text-fg-muted">{web.message ?? "Web search was skipped."}</p>;
}

export function StuckView() {
  const { repo } = useRepo();
  const { openSource } = useSourceDrawer();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: status } = useProviderStatus();

  const [problem, setProblem] = useState(params.get("q") ?? "");
  const [errorText, setErrorText] = useState("");
  const [code, setCode] = useState("");
  const [level, setLevel] = useState<Level>("beginner");
  const [searchWeb, setSearchWeb] = useState(true);
  const [focus, setFocus] = useState(() => {
    const fileId = params.get("file") ?? undefined;
    const symbolId = params.get("symbol") ?? undefined;
    return fileId ? { fileId, symbolId } : null;
  });
  const { data: focusFile } = useFileDetail(repo.id, focus?.fileId ?? null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [queries, setQueries] = useState<string[]>([]);
  const [planning, setPlanning] = useState(false);
  const [searching, setSearching] = useState(false);
  const [quickWeb, setQuickWeb] = useState<CbgDataParts["web"] | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [conversationId, setConversationId] = useState<string | null>(null);

  const { messages, sendMessage, status: chatStatus, stop, error } = useChat<CbgUIMessage>({
    id: `stuck-${repo.id}`,
    transport: new DefaultChatTransport({
      api: `/api/repos/${repo.id}/stuck`,
      prepareSendMessagesRequest: ({ body }) => ({ body: body ?? {} }),
    }),
    onData: (part) => {
      if (part.type === "data-meta") setConversationId(part.data.conversationId);
    },
  });
  const busy = chatStatus === "submitted" || chatStatus === "streaming";

  const payload = () => ({
    problem: problem.trim(),
    errorText: errorText.trim() || undefined,
    code: code.trim() || undefined,
    focus: focus ?? undefined,
    level,
  });

  const validate = () => {
    if (problem.trim().length < 3) {
      setFormError("Describe what you're trying to do or what's going wrong.");
      return false;
    }
    setFormError(null);
    return true;
  };

  async function findRelated() {
    if (!validate() || planning) return;
    setPlanning(true);
    try {
      const p = await api<Plan>(`/api/repos/${repo.id}/stuck/plan`, { method: "POST", body: JSON.stringify(payload()) });
      setPlan(p);
      setQueries(p.queries.slice(0, 2));
    } catch (e) {
      setFormError(e instanceof ClientApiError ? e.message : "Couldn't search the repository.");
    } finally {
      setPlanning(false);
    }
  }

  async function quickSearch() {
    const q = queries[0]?.trim();
    if (!q || searching) return;
    setSearching(true);
    try {
      setQuickWeb(await api<CbgDataParts["web"]>("/api/research", { method: "POST", body: JSON.stringify({ query: q, repositoryId: repo.id }) }));
    } catch (e) {
      setQuickWeb({ status: "failed", message: e instanceof ClientApiError ? e.message : "Search failed", queries: [q], items: [] });
    } finally {
      setSearching(false);
    }
  }

  function explain(e?: FormEvent) {
    e?.preventDefault();
    if (!validate() || busy) return;
    const body = { ...payload(), queries: queries.map((q) => q.trim()).filter((q) => q.length >= 3).slice(0, 3), searchWeb, conversationId: conversationId ?? undefined };
    sendMessage({ text: problem.trim() }, { body });
  }

  async function toggleSave(w: WebItem) {
    if (!w.id) return;
    const saved = !savedIds.has(w.id);
    await api(`/api/research/${w.id}`, { method: "PATCH", body: JSON.stringify({ saved }) });
    setSavedIds((s) => {
      const n = new Set(s);
      if (saved) n.add(w.id!);
      else n.delete(w.id!);
      return n;
    });
  }

  const latest = [...messages].reverse().find((m) => m.role === "assistant");
  const result = latest ? partsOf(latest) : null;
  const used = useMemo(() => new Set(result?.citations?.used ?? []), [result?.citations]);
  const onOpen = (ev: EvidenceItem) => openSource({ fileId: ev.fileId, startLine: ev.startLine, endLine: ev.endLine, title: `${ev.label} · ${ev.path}` });
  const handlers = useMemo(
    () => ({ evidence: new Map((result?.evidence ?? []).map((x) => [x.label, x])), web: new Map((result?.web?.items ?? []).map((x) => [x.label, x])), onOpenEvidence: onOpen }),
    [result?.evidence, result?.web], // eslint-disable-line react-hooks/exhaustive-deps
  );

  return (
    <div className="grid min-h-0 flex-1 xl:grid-cols-[420px_minmax(0,1fr)]">
      <form onSubmit={explain} className="space-y-4 border-b border-border p-4 sm:p-6 xl:overflow-auto xl:border-b-0 xl:border-r" aria-label="Describe the problem">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><LifeBuoy className="size-5 text-primary" aria-hidden /> I&apos;m stuck</h2>
          <p className="mt-1 text-[13px] text-fg-muted">We look in your repository first, then search the web, and keep the two clearly separate.</p>
        </div>
        <Field label="What are you trying to do, and what's going wrong?" error={formError}>
          {({ id, describedBy, invalid }) => <Textarea id={id} aria-describedby={describedBy} aria-invalid={invalid} rows={3} maxLength={4000} value={problem} onChange={(e) => setProblem(e.target.value)} placeholder="e.g. Logging in always says invalid credentials even with the right password" />}
        </Field>
        <Field label="Error message or stack trace" hint="Paste it exactly. Local paths are stripped from the web search.">
          {({ id, describedBy }) => <Textarea id={id} aria-describedby={describedBy} rows={4} maxLength={8000} value={errorText} onChange={(e) => setErrorText(e.target.value)} className="font-mono text-[12.5px]" placeholder="TypeError: Cannot read properties of undefined (reading 'split')" spellCheck={false} />}
        </Field>
        <Field label="Relevant code (optional)">
          {({ id }) => <Textarea id={id} rows={3} maxLength={8000} value={code} onChange={(e) => setCode(e.target.value)} className="font-mono text-[12.5px]" spellCheck={false} />}
        </Field>
        {focus ? (
          <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary-soft px-2.5 py-1.5 text-[12.5px]">
            <FileCode2 className="size-3.5 text-primary" aria-hidden />
            <span className="min-w-0 truncate font-mono">{focusFile ? focusFile.file.path : "Loading…"}{focus.symbolId && focusFile ? ` · ${focusFile.symbols.find((s) => s.id === focus.symbolId)?.name ?? ""}` : ""}</span>
            <button type="button" className="ml-auto grid size-6 cursor-pointer place-items-center rounded hover:bg-surface-3" aria-label="Remove focused file" onClick={() => { setFocus(null); router.replace(pathname, { scroll: false }); }}><X className="size-3.5" /></button>
          </div>
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <label className="text-[13px] font-medium">
            Explain for
            <select value={level} onChange={(e) => setLevel(e.target.value as Level)} className="ml-2 h-9 cursor-pointer rounded-md border border-border-strong bg-surface-2 px-2 text-sm max-md:h-11">
              <option value="beginner">a beginner</option>
              <option value="intermediate">intermediate</option>
              <option value="advanced">advanced</option>
            </select>
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-[13px]">
            <input type="checkbox" checked={searchWeb} onChange={(e) => setSearchWeb(e.target.checked)} className="size-4 accent-[var(--primary)]" /> Search the web
          </label>
        </div>

        {plan ? (
          <div className="space-y-2 rounded-lg border border-border bg-surface-2/50 p-3">
            <p className="text-[13px] font-medium">Web search queries <span className="font-normal text-fg-muted">(edit before searching)</span></p>
            {queries.map((q, i) => (
              <div key={i} className="flex gap-1.5">
                <Input value={q} onChange={(e) => setQueries((qs) => qs.map((x, j) => (j === i ? e.target.value : x)))} aria-label={`Search query ${i + 1}`} className="h-8 font-mono text-[12.5px]" maxLength={300} />
                <Button type="button" size="sm" variant="ghost" aria-label={`Remove query ${i + 1}`} onClick={() => setQueries((qs) => qs.filter((_, j) => j !== i))}><X /></Button>
              </div>
            ))}
            {queries.length < 3 ? (
              <button type="button" className="cursor-pointer text-xs text-primary hover:underline" onClick={() => setQueries((qs) => [...qs, plan.queries[qs.length] ?? ""])}>+ Add query</button>
            ) : null}
            {!plan.search.configured ? <p className="text-xs text-warning">Web search isn&apos;t configured on this server ({plan.search.missing.join(", ")}).</p> : null}
          </div>
        ) : null}

        <div className="flex flex-wrap gap-2">
          <Button type="submit" variant="primary" loading={busy} disabled={busy}><Sparkles /> Explain the error</Button>
          <Button type="button" onClick={findRelated} loading={planning}><FileCode2 /> Find related code</Button>
          <Button type="button" onClick={quickSearch} loading={searching} disabled={!plan || !queries[0]?.trim()} title={!plan ? "Find related code first to get search suggestions" : undefined}><Search /> Search the web</Button>
          {busy ? <Button type="button" variant="ghost" onClick={() => stop()}>Stop</Button> : null}
        </div>
        {status && !status.gemma.configured ? <p className="text-xs text-warning">Gemma isn&apos;t configured, so “Explain” will show retrieved code and web sources without an AI explanation.</p> : null}
      </form>

      <div className="min-w-0 space-y-4 p-4 sm:p-6 xl:overflow-auto">
        {!plan && !result && !quickWeb ? (
          <Panel className="p-6 text-[13px] text-fg-muted">
            <p className="font-medium text-fg">How this works</p>
            <ol className="mt-2 list-decimal space-y-1 pl-5">
              <li><span className="text-fg">Find related code</span> searches this repository using your description and stack trace.</li>
              <li><span className="text-fg">Search the web</span> runs a real search ({status?.search.configured ? status.search.provider : "not configured"}) and shows the sources. No AI involved.</li>
              <li><span className="text-fg">Explain the error</span> combines both and walks you through causes, debugging steps, and a suggested fix, with every claim linked to its source.</li>
            </ol>
          </Panel>
        ) : null}

        {result ? (
          <Panel className="p-4">
            <SectionTitle icon={Sparkles} tone="text-accent" title="AI explanation" note={result.meta?.model ? `${result.meta.model} · verify before applying` : undefined} />
            {result.status?.kind === "error" && result.status.code !== "provider_not_configured" ? <Notice tone="danger" title={result.status.message}>No explanation was generated.</Notice> : null}
            {result.text ? <AnswerMarkdown text={result.text} h={handlers} /> : <div className="space-y-2"><Skeleton className="h-4" /><Skeleton className="h-4 w-4/5" /><Skeleton className="h-4 w-2/3" /></div>}
            {result.citations?.invalid.length ? <p className="mt-2 text-xs text-warning">Unverified references removed: {result.citations.invalid.join(", ")}.</p> : null}
          </Panel>
        ) : null}
        {error ? <Notice tone="danger" title="The request failed">{error.message.startsWith("{") ? "The server rejected the request." : error.message}</Notice> : null}

        <div className="grid gap-4 lg:grid-cols-2">
          {result || plan ? (
            <Panel className="p-4">
              <SectionTitle icon={FileCode2} tone="text-primary" title="From your repository" note="verified source" />
              <EvidenceList items={result?.evidence.length ? result.evidence : (plan?.evidence ?? [])} used={result?.citations ? used : undefined} onOpen={onOpen} compact={Boolean(result)} />
            </Panel>
          ) : null}
          {result?.web || quickWeb ? (
            <Panel className="p-4">
              <SectionTitle icon={Globe} tone="text-info" title="From the web" note={(result?.web ?? quickWeb)!.queries.length ? `searched: ${(result?.web ?? quickWeb)!.queries.join(" · ")}` : undefined} />
              <WebStatus web={(result?.web ?? quickWeb)!} />
              <WebList items={(result?.web ?? quickWeb)!.items} used={result?.web && result.citations ? used : undefined} onSave={toggleSave} savedIds={savedIds} />
              {(result?.web ?? quickWeb)!.items.length ? <p className="mt-2 text-[11px] text-fg-subtle">Links open the original pages. Excerpts come from the search provider and weren&apos;t checked further.</p> : null}
            </Panel>
          ) : null}
        </div>
        {result && !busy ? (
          <div className="flex flex-wrap gap-2">
            <Badge tone="accent">Follow-up</Badge>
            {["Explain that more simply", "What should I check first?", "Show me how to verify the fix"].map((q) => (
              <button key={q} type="button" className="cursor-pointer rounded-full border border-border px-3 py-1 text-xs text-fg-muted hover:border-border-strong hover:text-fg" onClick={() => sendMessage({ text: q }, { body: { ...payload(), problem: q, queries: [], searchWeb: false, conversationId: conversationId ?? undefined } })}>
                {q}
              </button>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
