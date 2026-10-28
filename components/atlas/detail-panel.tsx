"use client";
import { ArrowDownLeft, ArrowUpRight, Code2, FolderOpen, LifeBuoy, ListTree, MessageSquareText } from "lucide-react";
import { useMemo } from "react";
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

function NeighborList({ title, icon: Icon, tone, items, onSelect }: { title: string; icon: typeof ArrowUpRight; tone: string; items: { node: GraphNode; weight: number }[]; onSelect: (id: string) => void }) {
  return (
    <div>
      <h3 className="mb-1.5 flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">
        <Icon className={`size-3.5 ${tone}`} aria-hidden /> {title} ({items.length})
      </h3>
      {items.length ? (
        <ul className="space-y-0.5">
          {items.slice(0, 40).map(({ node, weight }) => {
            const K = kindStyle(node).icon;
            return (
              <li key={node.id}>
                <button type="button" onClick={() => onSelect(node.id)} className="flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left text-[13px] hover:bg-surface-2">
                  <K className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
                  <span className="truncate font-mono">{node.kind === "file" || node.kind === "directory" ? node.path : node.label}</span>
                  {weight > 1 ? <span className="ml-auto shrink-0 font-mono text-[11px] text-fg-subtle">×{weight}</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : (
        <p className="px-1.5 text-[13px] text-fg-muted">None in this view.</p>
      )}
    </div>
  );
}

/** Context for the selected node: real metadata, code, and its direct dependencies/dependents. */
export function DetailPanel({ repoId, node, graph, onSelect, onExpand, onShowSymbols }: Props) {
  const { openSource } = useSourceDrawer();
  const k = kindStyle(node);
  const { data: file, isLoading } = useFileDetail(repoId, node.kind === "file" || node.kind === "symbol" ? (node.fileId ?? null) : null);
  const byId = useMemo(() => new Map(graph.nodes.map((n) => [n.id, n])), [graph.nodes]);
  const outgoing = graph.edges.filter((e) => e.source === node.id).map((e) => ({ node: byId.get(e.target)!, weight: e.weight })).filter((x) => x.node);
  const incoming = graph.edges.filter((e) => e.target === node.id).map((e) => ({ node: byId.get(e.source)!, weight: e.weight })).filter((x) => x.node);
  const relation = graph.mode === "symbols" ? ["Calls", "Called by"] : ["Depends on", "Used by"];
  const range = node.kind === "symbol" && node.startLine ? { start: node.startLine, end: node.endLine ?? node.startLine } : undefined;
  const preview = file && range ? file.file.content.split("\n").slice(range.start - 1, Math.min(range.end, range.start + 40)).join("\n") : null;

  const askHref =
    node.kind === "symbol" ? `/repos/${repoId}/ask?file=${node.fileId}&symbol=${node.symbolId}` : node.kind === "file" ? `/repos/${repoId}/ask?file=${node.fileId}` : `/repos/${repoId}/ask?q=${encodeURIComponent(`Explain the ${node.path}/ folder: what does it do and how does it connect to the rest of the codebase?`)}`;
  const stuckHref = node.kind === "file" || node.kind === "symbol" ? `/repos/${repoId}/stuck?file=${node.fileId}${node.symbolId ? `&symbol=${node.symbolId}` : ""}` : `/repos/${repoId}/stuck`;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="space-y-2 border-b border-border p-4">
        <div className="flex items-center gap-2">
          <k.icon className={`size-4 ${k.tone}`} aria-hidden />
          <Badge>{k.label}</Badge>
          {node.language ? <Badge tone="primary">{languageLabel(node.language)}</Badge> : null}
        </div>
        <h2 className="break-all font-mono text-[14px] font-semibold">{node.kind === "symbol" ? node.label : node.path || node.label}</h2>
        {node.kind === "symbol" ? (
          <p className="break-all font-mono text-xs text-fg-muted">
            {node.path}:{node.startLine}–{node.endLine}
          </p>
        ) : null}
        <dl className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-fg-muted">
          {node.files !== undefined ? <div><dt className="inline">Files </dt><dd className="inline font-mono text-fg">{node.files}</dd></div> : null}
          {node.lines !== undefined ? <div><dt className="inline">Lines </dt><dd className="inline font-mono text-fg">{node.lines.toLocaleString()}</dd></div> : null}
          {node.symbols !== undefined ? <div><dt className="inline">Symbols </dt><dd className="inline font-mono text-fg">{node.symbols}</dd></div> : null}
          <div><dt className="inline">In </dt><dd className="inline font-mono text-fg">{node.inDegree}</dd></div>
          <div><dt className="inline">Out </dt><dd className="inline font-mono text-fg">{node.outDegree}</dd></div>
        </dl>
        <div className="flex flex-wrap gap-1.5 pt-1">
          {node.kind === "directory" ? (
            <Button size="sm" variant="primary" onClick={() => onExpand(node.path)}><FolderOpen /> Expand folder</Button>
          ) : null}
          {node.kind === "file" ? (
            <>
              <Button size="sm" variant="primary" onClick={() => openSource({ fileId: node.fileId!, title: node.path })}><Code2 /> View source</Button>
              <Button size="sm" onClick={() => onShowSymbols(node.fileId!)}><ListTree /> Symbols & calls</Button>
            </>
          ) : null}
          {node.kind === "symbol" ? (
            <Button size="sm" variant="primary" onClick={() => openSource({ fileId: node.fileId!, startLine: node.startLine, endLine: node.endLine, title: `${node.label} · ${node.path}` })}><Code2 /> View source</Button>
          ) : null}
          {node.kind !== "external" ? (
            <>
              <ButtonLink size="sm" href={askHref}><MessageSquareText /> Ask about this</ButtonLink>
              <ButtonLink size="sm" variant="ghost" href={stuckHref}><LifeBuoy /> I&apos;m stuck here</ButtonLink>
            </>
          ) : null}
        </div>
      </div>
      <div className="min-h-0 flex-1 space-y-4 overflow-auto p-4">
        {node.kind === "symbol" ? (
          isLoading || !preview ? <Skeleton className="h-32" /> : <CodeView path={node.path} language={file!.file.language} content={preview} className="max-h-72 rounded-md border border-border" />
        ) : null}
        <NeighborList title={relation[0]} icon={ArrowUpRight} tone="text-primary" items={outgoing} onSelect={onSelect} />
        <NeighborList title={relation[1]} icon={ArrowDownLeft} tone="text-incoming" items={incoming} onSelect={onSelect} />
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
            {file.imports.some((i) => i.kind === "external") ? (
              <p className="mt-3 text-xs text-fg-muted">External: {[...new Set(file.imports.filter((i) => i.kind === "external").map((i) => i.specifier))].slice(0, 12).join(", ")}</p>
            ) : null}
            {file.imports.some((i) => i.kind === "unresolved") ? (
              <p className="mt-1 text-xs text-warning">Unresolved: {file.imports.filter((i) => i.kind === "unresolved").map((i) => i.specifier).join(", ")}</p>
            ) : null}
          </div>
        ) : null}
        {graph.mode === "symbols" ? <p className="text-xs text-fg-subtle">Call edges are resolved statically within a file and across imported files. Dynamic dispatch, callbacks and reflection can&apos;t be traced.</p> : null}
      </div>
    </div>
  );
}
