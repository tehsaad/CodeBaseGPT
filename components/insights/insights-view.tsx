"use client";
import { AlertTriangle, BarChart3, GitBranch, Info } from "lucide-react";
import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import useSWR from "swr";
import { fetcher, type ClientApiError } from "@/lib/client/api";
import { languageLabel } from "@/lib/code-intelligence/languages";
import { nf, relativeTime } from "@/lib/client/format";
import { EmptyState, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { useRepo } from "@/components/repos/repo-context";
import { useSourceDrawer } from "@/components/source/source-drawer";

const PALETTE = ["#6366F1", "#38BDF8", "#8B5CF6", "#34D399", "#FBBF24", "#F472B6", "#94A3B8"];

type Insights = {
  languages: { language: string | null; files: number; lines: number; bytes: number }[];
  largest: { id: string; path: string; lines: number; bytes: number }[];
  symbolKinds: { kind: string; n: number }[];
  mostImported: { id: string; path: string; n: number }[];
  mostImports: { id: string; path: string; n: number }[];
  unresolved: { file_id: string; path: string; specifier: string; line: number }[];
  complex: { id: string; file_id: string; path: string; name: string; parent_name: string | null; complexity: number; start_line: number; end_line: number }[];
  external: { name: string; n: number }[];
  cycles: { id: string; path: string }[][];
  parse: { status: string; n: number }[];
  complexityMethod: string;
};

const tooltipStyle = { background: "var(--surface-3)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12, color: "var(--fg)" };

function Card({ title, children, note }: { title: string; children: React.ReactNode; note?: React.ReactNode }) {
  return (
    <Panel className="min-w-0 p-4">
      <h2 className="text-sm font-semibold">{title}</h2>
      {note ? <p className="mt-0.5 text-xs text-fg-muted">{note}</p> : null}
      <div className="mt-3">{children}</div>
    </Panel>
  );
}

function FileTable({ rows, valueLabel, onOpen }: { rows: { id: string; path: string; n: number; line?: number }[]; valueLabel: string; onOpen: (id: string, path: string, line?: number) => void }) {
  if (!rows.length) return <p className="text-[13px] text-fg-muted">No data.</p>;
  return (
    <table className="w-full text-[13px]">
      <thead className="text-left text-[11px] uppercase tracking-wider text-fg-subtle"><tr><th className="pb-1.5 font-medium">File</th><th className="pb-1.5 text-right font-medium">{valueLabel}</th></tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={`${r.id}-${r.line ?? ""}`} className="border-t border-border">
            <td className="max-w-0 py-1.5 pr-3"><button type="button" onClick={() => onOpen(r.id, r.path, r.line)} className="block w-full cursor-pointer truncate text-left font-mono hover:text-primary">{r.path}</button></td>
            <td className="py-1.5 text-right font-mono">{nf.format(r.n)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export function InsightsView() {
  const { repo } = useRepo();
  const { openSource } = useSourceDrawer();
  const { data, error, isLoading } = useSWR<{ insights: Insights }, ClientApiError>(`/api/repos/${repo.id}/insights`, fetcher, { revalidateOnFocus: false });
  if (error) return <div className="p-6"><Notice tone="danger" title="Couldn't compute insights">{error.message}</Notice></div>;
  if (isLoading || !data) return <div className="grid gap-4 p-6 md:grid-cols-2">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}</div>;
  const ins = data.insights;
  if (!ins.languages.length) return <EmptyState icon={BarChart3} title="No indexed files">Re-index the repository to compute insights.</EmptyState>;
  const langs = ins.languages.map((l) => ({ name: languageLabel(l.language), lines: l.lines, files: l.files }));
  const open = (fileId: string, path: string, line?: number) => openSource({ fileId, startLine: line, endLine: line, title: path });

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 px-4 py-6 sm:px-6">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="text-[13px] text-fg-muted">All figures are measured from the {nf.format(repo.fileCount)} indexed files at {repo.commitSha ? <span className="font-mono">{repo.commitSha.slice(0, 7)}</span> : "upload time"} (indexed {relativeTime(repo.lastIndexedAt)}). Skipped files ({nf.format(repo.skippedCount)}) aren&apos;t counted.</p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Card title="Lines of code by language" note="Physical lines, including blanks and comments.">
          <div className="grid items-center gap-4 sm:grid-cols-[200px_minmax(0,1fr)]">
            <div className="h-48" role="img" aria-label={`Language share: ${langs.map((l) => `${l.name} ${l.lines} lines`).join(", ")}`}>
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={langs} dataKey="lines" nameKey="name" innerRadius={48} outerRadius={80} paddingAngle={1} stroke="var(--surface)">
                    {langs.map((_, i) => <Cell key={i} fill={PALETTE[i % PALETTE.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={tooltipStyle} formatter={(v) => [`${nf.format(Number(v))} lines`, ""]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-fg-subtle"><tr><th className="pb-1 font-medium">Language</th><th className="pb-1 text-right font-medium">Files</th><th className="pb-1 text-right font-medium">Lines</th></tr></thead>
              <tbody>
                {langs.map((l, i) => (
                  <tr key={l.name} className="border-t border-border">
                    <td className="py-1"><span className="mr-2 inline-block size-2.5 rounded-sm align-middle" style={{ background: PALETTE[i % PALETTE.length] }} />{l.name}</td>
                    <td className="py-1 text-right font-mono">{nf.format(l.files)}</td>
                    <td className="py-1 text-right font-mono">{nf.format(l.lines)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Symbols by kind" note="Extracted with Tree-sitter for TS/JS, Python, Java, C and C++.">
          {ins.symbolKinds.length ? (
            <div className="h-52" role="img" aria-label={`Symbols: ${ins.symbolKinds.map((s) => `${s.n} ${s.kind}`).join(", ")}`}>
              <ResponsiveContainer>
                <BarChart data={ins.symbolKinds} layout="vertical" margin={{ left: 8, right: 16 }}>
                  <CartesianGrid horizontal={false} stroke="var(--border)" />
                  <XAxis type="number" tick={{ fill: "var(--fg-muted)", fontSize: 11 }} stroke="var(--border)" allowDecimals={false} label={{ value: "count", position: "insideBottomRight", offset: -2, fill: "var(--fg-subtle)", fontSize: 11 }} />
                  <YAxis type="category" dataKey="kind" tick={{ fill: "var(--fg-muted)", fontSize: 12 }} stroke="var(--border)" width={80} />
                  <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "var(--surface-2)" }} />
                  <Bar dataKey="n" name="symbols" fill="#6366F1" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : <p className="text-[13px] text-fg-muted">No symbols were extracted (no supported languages).</p>}
        </Card>
        <Card title="Most depended-on files" note="Number of distinct files that import each file. Changes here have the widest reach.">
          <FileTable rows={ins.mostImported} valueLabel="Importers" onOpen={open} />
        </Card>
        <Card title="Files with the most internal dependencies" note="Number of distinct repository files each one imports.">
          <FileTable rows={ins.mostImports} valueLabel="Imports" onOpen={open} />
        </Card>
        <Card title="Functions to read carefully" note={<><Info className="mr-1 inline size-3" aria-hidden />{ins.complexityMethod}</>}>
          {ins.complex.length ? (
            <table className="w-full text-[13px]">
              <thead className="text-left text-[11px] uppercase tracking-wider text-fg-subtle"><tr><th className="pb-1.5 font-medium">Function</th><th className="pb-1.5 text-right font-medium">Score</th><th className="pb-1.5 text-right font-medium">Lines</th></tr></thead>
              <tbody>
                {ins.complex.map((c) => (
                  <tr key={c.id} className="border-t border-border">
                    <td className="max-w-0 py-1.5 pr-3">
                      <button type="button" onClick={() => openSource({ fileId: c.file_id, startLine: c.start_line, endLine: c.end_line, title: `${c.name} · ${c.path}` })} className="block w-full cursor-pointer truncate text-left hover:text-primary">
                        <span className="font-mono">{c.parent_name ? `${c.parent_name.split("::").pop()}.` : ""}{c.name}</span> <span className="text-xs text-fg-subtle">{c.path}:{c.start_line}</span>
                      </button>
                    </td>
                    <td className="py-1.5 text-right font-mono">{c.complexity}</td>
                    <td className="py-1.5 text-right font-mono text-fg-muted">{c.end_line - c.start_line + 1}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : <p className="text-[13px] text-fg-muted">No functions found.</p>}
        </Card>
        <Card title="Largest files">
          <FileTable rows={ins.largest.map((l) => ({ id: l.id, path: l.path, n: l.lines }))} valueLabel="Lines" onOpen={open} />
        </Card>
        <Card title="External packages" note="Imports that resolve outside the repository, by number of import statements.">
          {ins.external.length ? (
            <ul className="flex flex-wrap gap-1.5">
              {ins.external.map((e) => <li key={e.name} className="rounded-md border border-border bg-surface-2 px-2 py-0.5 font-mono text-xs">{e.name} <span className="text-fg-subtle">×{e.n}</span></li>)}
            </ul>
          ) : <p className="text-[13px] text-fg-muted">None detected.</p>}
        </Card>
        <Card title="Import cycles" note="Strongly connected groups of files that import each other (directly or transitively).">
          {ins.cycles.length ? (
            <ul className="space-y-2">
              {ins.cycles.map((c, i) => (
                <li key={i} className="rounded-md border border-warning/30 bg-warning/5 p-2">
                  <p className="mb-1 flex items-center gap-1.5 text-xs text-warning"><GitBranch className="size-3.5" aria-hidden /> {c.length} files</p>
                  <p className="break-all font-mono text-xs">{c.map((f) => f.path).join(" → ")}</p>
                </li>
              ))}
            </ul>
          ) : <p className="text-[13px] text-fg-muted">No cycles among resolved imports.</p>}
        </Card>
        {ins.unresolved.length ? (
          <Card title={`Unresolved imports (${ins.unresolved.length}${ins.unresolved.length === 50 ? "+" : ""})`} note="Imports that look internal but didn't match an indexed file (generated code, build aliases, or files that were skipped).">
            <ul className="space-y-1 text-[13px]">
              {ins.unresolved.slice(0, 20).map((u, i) => (
                <li key={i} className="flex items-center gap-2">
                  <AlertTriangle className="size-3.5 shrink-0 text-warning" aria-hidden />
                  <button type="button" className="cursor-pointer truncate font-mono hover:text-primary" onClick={() => open(u.file_id, u.path, u.line)}>{u.path}:{u.line}</button>
                  <span className="truncate font-mono text-xs text-fg-subtle">{u.specifier}</span>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
      <p className="text-xs text-fg-subtle">These are static measurements, not a security audit or a list of bugs. <Link href={`/repos/${repo.id}/ask`} className="text-primary hover:underline">Ask CodeBaseGPT</Link> to explain any of them.</p>
    </div>
  );
}
