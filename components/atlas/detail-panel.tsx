"use client";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Code2, FlaskConical, FolderOpen, GitFork, LifeBuoy, ListTree, MessageSquareText, Waypoints } from "lucide-react";
import { useMemo } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { languageLabel } from "@/lib/code-intelligence/languages";
import { Button, ButtonLink } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { CodeView, useFileDetail } from "@/components/source/source-viewer";
import { useSourceDrawer } from "@/components/source/source-drawer";
import { kindStyle } from "./atlas-node";
import type { GraphData, GraphNode } from "./types";

type Props = {
  repoId: string;
  node: GraphNode;
  graph: GraphData;
  onSelect: (id: string) => void;
  onExpand: (path: string) => void;
  onShowSymbols: (fileId: string) => void;
};

type Derivation = "same-file" | "via-import" | "unresolved";
type Relations = {
  calls: { line: number; name: string; derivation: Derivation; target: { id: string; name: string; fileId: string; path: string; startLine: number } | null }[];
  calledBy: { line: number; fileId: string; path: string; caller: { id: string; name: string } | null; derivation: Derivation }[];
};

const DERIVATION: Record<Derivation, { label: string; tone: "success" | "info" | "warning"; title: string }> = {
  "same-file": { label: "static", tone: "success", title: "Callee is defined in the same file (extracted from the syntax tree)." },
  "via-import": { label: "static · via import", tone: "info", title: "Callee name matched a symbol in a file this file imports. Static and name-based: dynamic dispatch can differ at runtime." },
  unresolved: { label: "unresolved", tone: "warning", title: "Only the called name is known (library call, dynamic dispatch, or ambiguous)." },
};

type Evidence = { line: number; fileId: string };

function LineChips({ items, onOpen }: { items: Evidence[]; onOpen: (e: Evidence) => void }) {
  if (!items.length) return null;
  return (
    <span className="ml-auto flex shrink-0 gap-1">
      {items.slice(0, 3).map((e) => (
        <button key={`${e.fileId}-${e.line}`} type="button" onClick={(ev) => { ev.stopPropagation(); onOpen(e); }} className="cursor-pointer rounded bg-surface-3 px-1 font-mono text-[10.5px] text-fg-muted hover:bg-primary-soft hover:text-primary" title="Open the import statement">
          L{e.line}
        </button>
      ))}
      {items.length > 3 ? <span className="font-mono text-[10.5px] text-fg-subtle">+{items.length - 3}</span> : null}
    </span>
  );
}

function NeighborList({ title, icon: Icon, tone, items, onSelect, evidenceFor, onOpen, note }: { title: string; icon: typeof ArrowUpRight; tone: string; items: { node: GraphNode; weight: number }[]; onSelect: (id: string) => void; evidenceFor?: (n: GraphNode) => Evidence[]; onOpen: (e: Evidence) => void; note?: string }) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        <Icon className={`size-3.5 ${tone}`} aria-hidden /> {title} ({items.length})
      </h3>
      {items.length ? (
        <ul className="space-y-0.5">
          {items.slice(0, 40).map(({ node, weight }) => {
            const K = kindStyle(node).icon;
            const ev = evidenceFor?.(node) ?? [];
            return (
              <li key={node.id} className="flex items-center gap-1">
                <button type="button" onClick={() => onSelect(node.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-surface-2">
                  <K className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                  <span className="truncate font-mono">{node.kind === "file" || node.kind === "directory" ? node.path : node.label}</span>
                  {weight > 1 && !ev.length ? <span className="ml-auto shrink-0 font-mono text-[11px] text-fg-subtle" title={`${weight} import statements`}>×{weight}</span> : null}
                </button>
                <LineChips items={ev} onOpen={onOpen} />
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1.5 text-[13px] text-fg-muted">None in this view.</p>
      )}
      {note && items.length ? <p className="mt-1 px-1.5 text-[11px] text-fg-subtle">{note}</p> : null}
    </div>
  );
}

function CallList({ title, icon: Icon, tone, rows, onOpen }: { title: string; icon: typeof ArrowUpRight; tone: string; rows: { key: string; label: string; sub: string; line: number; fileId: string; derivation: Derivation }[]; onOpen: (e: Evidence) => void }) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        <Icon className={`size-3.5 ${tone}`} aria-hidden /> {title} ({rows.length})
      </h3>
      {rows.length ? (
        <ul className="space-y-0.5">
          {rows.slice(0, 40).map((r) => {
            const d = DERIVATION[r.derivation];
            return (
              <li key={r.key}>
                <button type="button" onClick={() => onOpen({ line: r.line, fileId: r.fileId })} className="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-surface-2" title={`${d.title} Opens the call site.`}>
                  <span className="truncate font-mono">{r.label}</span>
                  <span className="truncate text-[11px] text-fg-subtle">{r.sub}</span>
                  <span className="ml-auto flex shrink-0 items-center gap-1">
                    <Badge tone={d.tone}>{d.label}</Badge>
                    <span className="font-mono text-[10.5px] text-fg-muted">L{r.line}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1.5 text-[13px] text-fg-muted">None found by static analysis.</p>
      )}
    </div>
  );
}

/** Context for the selected node: real metadata, code, relationship evidence, and next actions. */
export function DetailPanel({ repoId, node, graph, onSelect, onExpand, onShowSymbols }: Props) {
  const { openSource } = useSourceDrawer();
  const k = kindStyle(node);
  const { data: file, isLoading } = useFileDetail(repoId, node.kind === "file" || node.kind === "symbol" ? (node.fileId ?? null) : null);
  const { data: rel } = useSWR<Relations>(node.kind === "symbol" && node.symbolId ? `/api/repos/${repoId}/symbols/${node.symbolId}` : null, fetcher, { revalidateOnFocus: false });
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const outgoing = graph.edges.filter((e) => e.source === node.id).map((e) => ({ node: byId.get(e.target)!, weight: e.weight })).filter((x) => x.node);
  const incoming = graph.edges.filter((e) => e.target === node.id).map((e) => ({ node: byId.get(e.source)!, weight: e.weight })).filter((x) => x.node);
  const range = node.kind === "symbol" && node.startLine ? { start: node.startLine, end: node.endLine ?? node.startLine } : undefined;
  const preview = file && range ? file.file.content.split("\n").slice(range.start - 1, Math.min(range.end, range.start + 40)).join("\n") : null;
  const open = (e: Evidence) => openSource({ fileId: e.fileId, startLine: e.line, endLine: e.line, title: "Relationship evidence" });

  // Import-statement evidence for file nodes (outgoing: lines in this file; incoming: lines in the importer).
  const matches = (target: GraphNode, path: string | null) => Boolean(path) && (target.kind === "directory" ? path!.startsWith(`${target.path}/`) : path === target.path);
  const outEvidence = (n: GraphNode): Evidence[] => (file && node.kind === "file" ? file.imports.filter((im) => matches(n, im.targetPath)).map((im) => ({ line: im.line, fileId: node.fileId! })) : []);
  const inEvidence = (n: GraphNode): Evidence[] => (file && node.kind === "file" ? file.dependents.filter((dep) => matches(n, dep.path)).map((dep) => ({ line: dep.line, fileId: dep.fileId })) : []);

  const subject = node.kind === "symbol" ? `\`${node.label}\` in ${node.path}` : node.kind === "directory" ? `the ${node.path}/ folder` : node.path;
  const focusQs = node.kind === "symbol" ? `file=${node.fileId}&symbol=${node.symbolId}` : node.kind === "file" ? `file=${node.fileId}` : "";
  const ask = (q: string) => `/repos/${repoId}/ask?${focusQs}${focusQs ? "&" : ""}q=${encodeURIComponent(q)}`;
  const impact = node.kind === "symbol" ? `/repos/${repoId}/impact?symbol=${node.symbolId}` : node.kind === "file" ? `/repos/${repoId}/impact?file=${node.fileId}` : null;
  const stuckHref = node.kind === "file" || node.kind === "symbol" ? `/repos/${repoId}/stuck?file=${node.fileId}${node.symbolId ? `&symbol=${node.symbolId}` : ""}` : `/repos/${repoId}/stuck`;
  const relation = graph.mode === "symbols" ? ["Calls", "Called by"] : ["Depends on", "Used by"];

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <k.icon className={`size-4 ${k.tone}`} aria-hidden />
          <Badge>{k.label}</Badge>
          {node.language ? <Badge tone="primary">{languageLabel(node.language)}</Badge> : null}
        </div>
        <h2 className="break-all font-mono text-[14px] font-semibold">{node.kind === "symbol" ? node.label : node.path || node.label}</h2>
        {node.kind === "symbol" ? <p className="break-all font-mono text-xs text-fg-muted">{node.path}:{node.startLine}–{node.endLine}</p> : null}
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
          {node.files !== undefined ? <div><dt className="inline">Files </dt><dd className="inline font-mono text-fg">{node.files}</dd></div> : null}
          {node.lines !== undefined ? <div><dt className="inline">Lines </dt><dd className="inline font-mono text-fg">{node.lines.toLocaleString()}</dd></div> : null}
          {node.symbols !== undefined ? <div><dt className="inline">Symbols </dt><dd className="inline font-mono text-fg">{node.symbols}</dd></div> : null}
          <div><dt className="inline">In </dt><dd className="inline font-mono text-fg">{node.inDegree}</dd></div>
          <div><dt className="inline">Out </dt><dd className="inline font-mono text-fg">{node.outDegree}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {node.kind === "directory" ? <Button size="sm" variant="primary" onClick={() => onExpand(node.path)}><FolderOpen /> Expand folder</Button> : null}
          {node.kind === "file" ? (
            <>
              <Button size="sm" variant="primary" onClick={() => openSource({ fileId: node.fileId!, title: node.path })}><Code2 /> View source</Button>
              <Button size="sm" onClick={() => onShowSymbols(node.fileId!)}><ListTree /> Symbols & calls</Button>
            </>
          ) : null}
          {node.kind === "symbol" ? <Button size="sm" variant="primary" onClick={() => openSource({ fileId: node.fileId!, startLine: node.startLine, endLine: node.endLine, title: `${node.label} · ${node.path}` })}><Code2 /> View source</Button> : null}
        </div>
        {node.kind !== "external" ? (
          <nav aria-label="Actions for this node" className="grid grid-cols-2 gap-1 pt-1">
            <ButtonLink size="sm" variant="ghost" className="justify-start" href={ask(`Explain ${subject} to a beginner: what it is for and how it works.`)}><BookOpen /> Explain this</ButtonLink>
            <ButtonLink size="sm" variant="ghost" className="justify-start" href={ask(`How does ${subject} work together with what it depends on? Walk through the key interactions.`)}><Waypoints /> With its dependencies</ButtonLink>
            {impact ? <ButtonLink size="sm" variant="ghost" className="justify-start" href={impact}><GitFork /> What depends on this</ButtonLink> : null}
            {impact ? <ButtonLink size="sm" variant="ghost" className="justify-start" href={`${impact}#tests`}><FlaskConical /> Related tests</ButtonLink> : null}
            <ButtonLink size="sm" variant="ghost" className="justify-start" href={ask("")}><MessageSquareText /> Ask about this</ButtonLink>
            <ButtonLink size="sm" variant="ghost" className="justify-start" href={stuckHref}><LifeBuoy /> Debug here</ButtonLink>
          </nav>
        ) : null}
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {node.kind === "symbol" ? (isLoading || !preview ? <Skeleton className="h-32" /> : <CodeView path={node.path} language={file!.file.language} content={preview} className="max-h-72 rounded-md border border-border" />) : null}
        {node.kind === "symbol" ? (
          rel ? (
            <>
              <CallList title="Calls" icon={ArrowUpRight} tone="text-primary" onOpen={open} rows={rel.calls.map((c, n) => ({ key: `o${n}`, label: c.target?.name ?? c.name, sub: c.target ? `${c.target.path.split("/").pop()}:${c.target.startLine}` : "", line: c.line, fileId: node.fileId!, derivation: c.derivation }))} />
              <CallList title="Called by" icon={ArrowDownLeft} tone="text-incoming" onOpen={open} rows={rel.calledBy.map((c, n) => ({ key: `i${n}`, label: c.caller?.name ?? "(top level)", sub: c.path.split("/").pop() ?? "", line: c.line, fileId: c.fileId, derivation: c.derivation }))} />
              <p className="text-xs text-fg-subtle">Call sites are extracted statically from the syntax tree. They show what the code can call, not a runtime trace; dynamic dispatch, callbacks and reflection may differ.</p>
            </>
          ) : (
            <Skeleton className="h-24" />
          )
        ) : (
          <>
            <NeighborList title={relation[0]} icon={ArrowUpRight} tone="text-primary" items={outgoing} onSelect={onSelect} evidenceFor={outEvidence} onOpen={open} note={node.kind === "file" ? "Line chips open the import statement (extracted from the source)." : node.kind === "directory" ? "Aggregated from the import statements of the files inside these folders." : undefined} />
            <NeighborList title={relation[1]} icon={ArrowDownLeft} tone="text-incoming" items={incoming} onSelect={onSelect} evidenceFor={inEvidence} onOpen={open} />
          </>
        )}
        {node.kind === "file" && file ? (
          <div>
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Defined here ({file.symbols.length})</h3>
            <ul className="space-y-0.5">
              {file.symbols.slice(0, 50).map((s) => (
                <li key={s.id}>
                  <button type="button" className="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-surface-2" onClick={() => openSource({ fileId: node.fileId!, startLine: s.startLine, endLine: s.endLine, title: `${s.name} · ${node.path}` })}>
                    <span className="truncate font-mono">{s.parentName ? `${s.parentName.split("::").pop()}.` : ""}{s.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-fg-subtle">{s.kind} · L{s.startLine}</span>
                  </button>
                </li>
              ))}
            </ul>
            {file.imports.some((im) => im.kind === "external") ? <p className="mt-3 text-xs text-fg-muted">External: {[...new Set(file.imports.filter((im) => im.kind === "external").map((im) => im.specifier))].slice(0, 12).join(", ")}</p> : null}
            {file.imports.some((im) => im.kind === "unresolved") ? <p className="mt-1 text-xs text-warning">Unresolved: {file.imports.filter((im) => im.kind === "unresolved").map((im) => im.specifier).join(", ")}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
