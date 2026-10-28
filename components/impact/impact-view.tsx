"use client";
import { ArrowDownLeft, ArrowRight, ArrowUpRight, Braces, Database, FileCode2, FlaskConical, GitFork, MessageSquareText, Network, Route, Search, ShieldAlert } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import useSWR from "swr";
import { api, fetcher, type ClientApiError } from "@/lib/client/api";
import { ButtonLink } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { Badge, EmptyState, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { useRepo } from "@/components/repos/repo-context";
import { useSourceDrawer } from "@/components/source/source-drawer";

type Link_ = { fileId: string; path: string; line: number | null };
type Impact = {
  target: { fileId: string; path: string; symbol: { id: string; name: string; kind: string; startLine: number; endLine: number } | null };
  dependencies: { fileId: string; path: string; line: number }[];
  directDependents: { fileId: string; path: string; line: number }[];
  transitiveDependents: { fileId: string; path: string; depth: number; chain: Link_[] }[];
  tests: { fileId: string; path: string; evidence: "extracted" | "inferred"; chain: Link_[] }[];
  entryPoints: { fileId: string; path: string; chain: Link_[] }[];
  dataTouch: { fileId: string; path: string; reason: string; line: number | null }[];
  calls: { callers: { line: number; fileId: string; path: string; caller: string | null }[]; sameNameUnresolved: { line: number; fileId: string; path: string }[] } | null;
  steps: string[];
  completeness: { maxDepth: number; capped: boolean; unresolvedImportsInFile: boolean; unresolvedImportsInRepo: number; note: string };
};
type Hit = { type: "symbol" | "file"; id: string; fileId: string; name: string; path: string; kind: string | null; startLine: number | null };

function Section({ id, icon: Icon, title, count, children, hint }: { id?: string; icon: typeof GitFork; title: string; count: number; children: ReactNode; hint?: string }) {
  return (
    <Panel className="p-4" as="section">
      <h2 id={id} className="flex scroll-mt-24 items-center gap-2 text-sm font-semibold"><Icon className="size-4 text-primary" aria-hidden /> {title} <Badge>{count}</Badge></h2>
      {hint ? <p className="mt-0.5 text-xs text-fg-muted">{hint}</p> : null}
      <div className="mt-3">{count ? children : <p className="text-[13px] text-fg-muted">None found.</p>}</div>
    </Panel>
  );
}

function Evidence({ kind }: { kind: "extracted" | "inferred" }) {
  return kind === "extracted" ? <Badge tone="success">extracted</Badge> : <Badge tone="warning">inferred</Badge>;
}

export function ImpactView() {
  const { repo } = useRepo();
  const { openSource } = useSourceDrawer();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const file = params.get("file");
  const symbol = params.get("symbol");
  const key = file || symbol ? `/api/repos/${repo.id}/impact?${symbol ? `symbol=${symbol}` : `file=${file}`}` : null;
  const { data, error, isLoading } = useSWR<Impact, ClientApiError>(key, fetcher, { revalidateOnFocus: false });
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  useEffect(() => {
    if (q.trim().length < 2) return;
    const t = setTimeout(() => api<{ results: Hit[] }>(`/api/repos/${repo.id}/search?q=${encodeURIComponent(q.trim())}`).then((r) => setHits(r.results.slice(0, 8))).catch(() => setHits([])), 200);
    return () => clearTimeout(t);
  }, [q, repo.id]);
  useEffect(() => {
    if (data && location.hash) document.querySelector(location.hash)?.scrollIntoView({ block: "start" });
  }, [data]);

  const open = (fileId: string, line?: number | null) => openSource({ fileId, startLine: line ?? undefined, endLine: line ?? undefined, title: "Impact evidence" });
  const fileLink = (f: { fileId: string; path: string; line?: number | null }) => (
    <button type="button" onClick={() => open(f.fileId, f.line)} className="cursor-pointer truncate text-left font-mono text-[13px] hover:text-primary">
      {f.path}{f.line ? <span className="text-fg-subtle">:{f.line}</span> : null}
    </button>
  );
  const chain = (c: Link_[]) => (
    <span className="flex flex-wrap items-center gap-1 text-[11.5px] text-fg-muted">
      {c.map((l, n) => (
        <span key={`${l.fileId}-${n}`} className="flex items-center gap-1">
          <button type="button" onClick={() => open(l.fileId, l.line)} className="cursor-pointer font-mono hover:text-primary" title={l.line ? `imports the next file at line ${l.line}` : undefined}>{l.path.split("/").pop()}{l.line ? `:${l.line}` : ""}</button>
          {n < c.length - 1 ? <ArrowRight className="size-3" aria-hidden /> : null}
        </span>
      ))}
    </span>
  );

  const subject = data ? (data.target.symbol ? `\`${data.target.symbol.name}\` in ${data.target.path}` : data.target.path) : "";
  const focusQs = data ? (data.target.symbol ? `file=${data.target.fileId}&symbol=${data.target.symbol.id}` : `file=${data.target.fileId}`) : "";
  const ask = (text: string) => `/repos/${repo.id}/ask?${focusQs}&q=${encodeURIComponent(text)}`;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-lg font-semibold"><GitFork className="size-5 text-primary" aria-hidden /> Change impact</h1>
          <p className="text-[13px] text-fg-muted">What depends on a file or function, how it&apos;s reached, and what to verify before changing it.</p>
        </div>
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pick a file or function…" aria-label="Pick a file or function" className="pl-8" />
          {q.trim().length >= 2 && hits.length ? (
            <ul className="absolute left-0 right-0 top-10 z-20 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-overlay" role="listbox">
              {hits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  <button type="button" role="option" aria-selected={false} className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-surface-2" onClick={() => { setQ(""); setHits([]); router.push(`${pathname}?${h.type === "file" ? `file=${h.fileId}` : `symbol=${h.id}`}`); }}>
                    {h.type === "file" ? <FileCode2 className="size-3.5 text-primary" aria-hidden /> : <Braces className="size-3.5 text-info" aria-hidden />}
                    <span className="truncate font-mono">{h.type === "file" ? h.path : h.name}</span>
                    {h.type === "symbol" ? <span className="ml-auto shrink-0 text-[11px] text-fg-subtle">{h.path.split("/").pop()}:{h.startLine}</span> : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </div>

      {!key ? (
        <Panel><EmptyState icon={GitFork} title="Choose something to analyse">Search for a file or function above, or use “What depends on this” from the Atlas.</EmptyState></Panel>
      ) : error ? (
        <Notice tone="danger" title="Couldn't analyse impact">{error.message}</Notice>
      ) : isLoading || !data ? (
        <div className="grid gap-4 md:grid-cols-2">{[0, 1, 2, 3].map((n) => <Skeleton key={n} className="h-40" />)}</div>
      ) : (
        <>
          <Panel className="p-4">
            <div className="flex flex-wrap items-center gap-2">
              {data.target.symbol ? <Braces className="size-4 text-info" aria-hidden /> : <FileCode2 className="size-4 text-primary" aria-hidden />}
              <span className="font-mono text-[14px] font-semibold">{data.target.symbol ? data.target.symbol.name : data.target.path}</span>
              {data.target.symbol ? <button type="button" onClick={() => open(data.target.fileId, data.target.symbol!.startLine)} className="cursor-pointer font-mono text-xs text-fg-muted hover:text-primary">{data.target.path}:{data.target.symbol.startLine}</button> : null}
            </div>
            <dl className="mt-3 grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
              {[["Direct dependents", data.directDependents.length], ["Transitive dependents", data.transitiveDependents.length], ["Related tests", data.tests.length], ["Entry points reached", data.entryPoints.length]].map(([k, v]) => (
                <div key={k as string} className="rounded-lg border border-border p-2"><dd className="font-mono text-xl">{v}</dd><dt className="text-[11px] text-fg-muted">{k}</dt></div>
              ))}
            </dl>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <ButtonLink size="sm" variant="primary" href={ask(`What could break if I change ${subject}? Use the importers and call sites in the evidence.`)}><MessageSquareText /> What could break?</ButtonLink>
              <ButtonLink size="sm" href={ask(`Explain the impact of changing ${subject} for a beginner: who uses it and why it matters.`)}>Explain for a beginner</ButtonLink>
              <ButtonLink size="sm" variant="ghost" href={`/repos/${repo.id}/atlas?node=${encodeURIComponent(`file:${data.target.path}`)}`}><Network /> Show in Atlas</ButtonLink>
            </div>
            <p className="mt-3 flex items-start gap-1.5 text-xs text-fg-muted"><ShieldAlert className="mt-0.5 size-3.5 shrink-0 text-warning" aria-hidden /> {data.completeness.note}{data.completeness.capped ? " Results were capped for size." : ""}{data.completeness.unresolvedImportsInRepo ? ` The repository has ${data.completeness.unresolvedImportsInRepo} unresolved import(s), which may hide dependents.` : ""}</p>
          </Panel>

          <Panel className="p-4">
            <h2 className="text-sm font-semibold">Suggested verification</h2>
            <ol className="mt-2 list-decimal space-y-1 pl-5 text-[13.5px]">{data.steps.map((s) => <li key={s}>{s}</li>)}</ol>
          </Panel>

          <div className="grid gap-4 lg:grid-cols-2">
            <Section icon={ArrowDownLeft} title="Imported directly by" count={data.directDependents.length} hint="Extracted from import statements; line = the import in that file.">
              <ul className="space-y-1">{data.directDependents.map((d) => <li key={`${d.fileId}-${d.line}`}>{fileLink(d)}</li>)}</ul>
            </Section>
            <Section icon={ArrowUpRight} title="Depends on" count={data.dependencies.length} hint="Files this one imports (internal only).">
              <ul className="space-y-1">{data.dependencies.map((d) => <li key={`${d.fileId}-${d.line}`}>{fileLink({ ...d, fileId: d.fileId, line: null })} <span className="text-[11px] text-fg-subtle">imported at line {d.line}</span></li>)}</ul>
            </Section>
            {data.calls ? (
              <Section icon={Braces} title="Call sites" count={data.calls.callers.length + data.calls.sameNameUnresolved.length} hint="Resolved calls are extracted; same-name calls could not be tied to this definition and may refer to something else.">
                <ul className="space-y-1">
                  {data.calls.callers.map((c) => <li key={`r${c.fileId}-${c.line}`} className="flex items-center gap-2">{fileLink(c)} <span className="text-[11px] text-fg-subtle">in {c.caller ?? "top level"}</span> <Evidence kind="extracted" /></li>)}
                  {data.calls.sameNameUnresolved.map((c) => <li key={`u${c.fileId}-${c.line}`} className="flex items-center gap-2">{fileLink(c)} <Evidence kind="inferred" /></li>)}
                </ul>
              </Section>
            ) : null}
            <Section id="tests" icon={FlaskConical} title="Related tests" count={data.tests.length} hint="Extracted = the test imports this code (path shown). Inferred = name match only.">
              <ul className="space-y-2">{data.tests.map((t) => <li key={t.fileId}><div className="flex items-center gap-2">{fileLink(t)} <Evidence kind={t.evidence} /></div>{t.chain.length ? chain(t.chain) : null}</li>)}</ul>
            </Section>
            <Section icon={Route} title="Entry points that reach it" count={data.entryPoints.length} hint="Routes, pages, mains and CLIs (by path convention) that transitively import it.">
              <ul className="space-y-2">{data.entryPoints.map((e) => <li key={e.fileId}>{fileLink(e)}{chain(e.chain)}</li>)}</ul>
            </Section>
            <Section icon={Database} title="Data access nearby" count={data.dataTouch.length} hint="Heuristic: path names and database packages in this file and its direct neighbours.">
              <ul className="space-y-1">{data.dataTouch.map((d, n) => <li key={n} className="flex items-center gap-2">{fileLink(d)} <span className="text-[11px] text-fg-subtle">{d.reason}</span> <Evidence kind="inferred" /></li>)}</ul>
            </Section>
          </div>

          <Section icon={GitFork} title="Transitive dependents" count={data.transitiveDependents.length} hint={`Files that reach it through other files (up to ${data.completeness.maxDepth} hops). Each row shows the dependency path.`}>
            <ul className="space-y-2">{data.transitiveDependents.slice(0, 100).map((t) => <li key={t.fileId}><div className="flex items-center gap-2">{fileLink(t)} <Badge>{t.depth} hops</Badge></div>{chain(t.chain)}</li>)}</ul>
            {data.transitiveDependents.length > 100 ? <p className="mt-2 text-xs text-fg-muted">Showing 100 of {data.transitiveDependents.length}.</p> : null}
          </Section>
          <p className="text-xs text-fg-subtle"><Link href={`/repos/${repo.id}/insights`} className="text-primary hover:underline">Insights</Link> lists the most depended-on files across the repository.</p>
        </>
      )}
    </div>
  );
}
