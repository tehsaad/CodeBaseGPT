"use client";
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  type Edge,
  type Node,
} from "@xyflow/react";
import { ChevronRight, FolderTree, ListTree, Maximize2, Network, RotateCcw, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { api, fetcher, type ClientApiError } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { languageLabel } from "@/lib/code-intelligence/languages";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/field";
import { EmptyState, Notice, Skeleton } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { useRepo } from "@/components/repos/repo-context";
import { AtlasNode, kindStyle, type AtlasNodeData } from "./atlas-node";
import { DetailPanel } from "./detail-panel";
import { layoutGraph } from "./layout";
import type { AtlasMode, GraphData, GraphNode } from "./types";

const nodeTypes = { cbg: AtlasNode };

const MODES: { id: AtlasMode; label: string; icon: typeof Network; help: string }[] = [
  { id: "architecture", label: "Architecture", icon: FolderTree, help: "Folders collapse their contents; expand to drill in. Edges are aggregated imports." },
  { id: "dependencies", label: "Dependencies", icon: Network, help: "Every connected file and its import edges." },
  { id: "symbols", label: "Symbols & calls", icon: ListTree, help: "Functions/classes and statically resolved calls for a folder or file." },
];

function useIsDesktop() {
  const [desktop, setDesktop] = useState(true);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 1024px)");
    const update = () => setDesktop(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return desktop;
}

function ancestors(path: string) {
  const parts = path.split("/");
  return parts.slice(0, -1).map((_, i) => parts.slice(0, i + 1).join("/"));
}

type SearchHit = { type: "symbol" | "file"; id: string; fileId: string; name: string; path: string; kind: string | null; startLine: number | null };

function AtlasInner() {
  const { repo } = useRepo();
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const desktop = useIsDesktop();
  const flow = useReactFlow();

  const mode = (params.get("mode") as AtlasMode) || "architecture";
  const expanded = useMemo(() => (params.get("expanded") ?? "").split(",").filter(Boolean), [params]);
  const language = params.get("lang") ?? "";
  const dir = params.get("dir") ?? "";
  const fileScope = params.get("file") ?? "";
  const external = params.get("ext") === "1";
  const selectedId = params.get("node");
  const [view, setView] = useState<"graph" | "outline">("graph");
  const [filter, setFilter] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);

  const setParams = useCallback(
    (patch: Record<string, string | null>) => {
      const next = new URLSearchParams(params.toString());
      for (const [k, v] of Object.entries(patch)) {
        if (v === null || v === "") next.delete(k);
        else next.set(k, v);
      }
      router.replace(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [params, pathname, router],
  );

  // Deep link from Source viewer / palette: expand the ancestors of a selected file node.
  useEffect(() => {
    if (mode !== "architecture" || !selectedId?.startsWith("file:")) return;
    const needed = ancestors(selectedId.slice(5)).filter((a) => !expanded.includes(a));
    if (needed.length) setParams({ expanded: [...expanded, ...needed].join(",") });
  }, [selectedId, mode]); // eslint-disable-line react-hooks/exhaustive-deps

  const query = new URLSearchParams({ mode });
  if (mode === "architecture" && expanded.length) query.set("expanded", expanded.join(","));
  if (language) query.set("language", language);
  if (mode !== "architecture" && dir) query.set("dir", dir);
  if (mode === "symbols" && fileScope) query.set("fileId", fileScope);
  if (mode === "dependencies" && external) query.set("external", "1");
  const key = `/api/repos/${repo.id}/graph?${query.toString()}`;
  const { data, error, isLoading, mutate } = useSWR<GraphData, ClientApiError>(key, fetcher, { keepPreviousData: true, revalidateOnFocus: false });

  const direction: "LR" | "TB" = desktop ? "LR" : "TB";
  const positions = useMemo(() => (data ? layoutGraph(data, direction) : new Map()), [data, direction]);
  const selected = data?.nodes.find((n) => n.id === selectedId) ?? null;

  const related = useMemo(() => {
    const out = new Set<string>();
    const inc = new Set<string>();
    if (data && selectedId) for (const e of data.edges) {
      if (e.source === selectedId) out.add(e.target);
      if (e.target === selectedId) inc.add(e.source);
    }
    return { out, inc };
  }, [data, selectedId]);

  const lowered = filter.trim().toLowerCase();
  const matches = useMemo(() => new Set(lowered ? (data?.nodes ?? []).filter((n) => n.label.toLowerCase().includes(lowered) || n.path.toLowerCase().includes(lowered)).map((n) => n.id) : []), [data, lowered]);

  const nodes: Node<AtlasNodeData>[] = useMemo(
    () =>
      (data?.nodes ?? []).map((n) => {
        let state: AtlasNodeData["state"] = "default";
        if (selectedId) state = n.id === selectedId ? "selected" : related.out.has(n.id) ? "outgoing" : related.inc.has(n.id) ? "incoming" : "dimmed";
        else if (lowered) state = matches.has(n.id) ? "match" : "dimmed";
        return { id: n.id, type: "cbg", position: positions.get(n.id) ?? { x: 0, y: 0 }, data: { ...n, state, direction }, draggable: false, ariaLabel: `${kindStyle(n).label} ${n.path || n.label}` };
      }),
    [data, positions, selectedId, related, matches, lowered, direction],
  );

  const edges: Edge[] = useMemo(
    () =>
      (data?.edges ?? []).map((e) => {
        const isOut = selectedId && e.source === selectedId;
        const isIn = selectedId && e.target === selectedId;
        const color = isOut ? "var(--primary)" : isIn ? "var(--incoming)" : "var(--fg-subtle)";
        const faded = selectedId && !isOut && !isIn;
        return {
          id: e.id,
          source: e.source,
          target: e.target,
          markerEnd: { type: MarkerType.ArrowClosed, width: 14, height: 14, color },
          style: { stroke: color, strokeWidth: isOut || isIn ? 2 : Math.min(1 + Math.log2(e.weight), 3), opacity: faded ? 0.12 : isOut || isIn ? 1 : 0.5, strokeDasharray: e.kind === "call" ? "4 3" : undefined },
          label: e.weight > 1 && (isOut || isIn) ? String(e.weight) : undefined,
          labelStyle: { fill: "var(--fg-muted)", fontSize: 10 },
          labelBgStyle: { fill: "var(--surface)" },
        };
      }),
    [data, selectedId],
  );

  const fitKey = `${key}|${direction}`;
  const lastFit = useRef("");
  useEffect(() => {
    if (!data || lastFit.current === fitKey) return;
    lastFit.current = fitKey;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => flow.fitView({ padding: 0.15, duration: reduce ? 0 : 300, maxZoom: 1.2 }));
  }, [data, fitKey, flow]);

  useEffect(() => {
    if (!selected || !desktop) return;
    const p = positions.get(selected.id);
    if (p) flow.setCenter(p.x + 100, p.y + 29, { zoom: Math.max(flow.getZoom(), 0.8), duration: 250 });
  }, [selected?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  // Repository-wide search (beyond what is currently visible).
  useEffect(() => {
    if (lowered.length < 2) return;
    const t = setTimeout(() => {
      api<{ results: SearchHit[] }>(`/api/repos/${repo.id}/search?q=${encodeURIComponent(filter.trim())}`).then((r) => setHits(r.results.slice(0, 8))).catch(() => setHits([]));
    }, 200);
    return () => clearTimeout(t);
  }, [lowered, filter, repo.id]);

  const select = (id: string | null) => setParams({ node: id });
  const expand = (path: string) => setParams({ expanded: [...new Set([...expanded, path])].join(","), node: null });
  const collapseTo = (path: string | null) => setParams({ expanded: path === null ? null : expanded.filter((e) => e !== path && !e.startsWith(`${path}/`)).join(","), node: null });
  const showSymbols = (fileId: string) => setParams({ mode: "symbols", file: fileId, dir: null, node: null });
  const jumpTo = (h: SearchHit) => {
    setFilter("");
    setHits([]);
    if (h.type === "file") setParams({ mode: "architecture", node: `file:${h.path}`, expanded: [...new Set([...expanded, ...ancestors(h.path)])].join(","), lang: null });
    else setParams({ mode: "symbols", file: h.fileId, dir: null, node: `sym:${h.id}`, lang: null });
  };

  const modeInfo = MODES.find((m) => m.id === mode)!;
  const topExpanded = expanded.filter((e) => !e.includes("/")).sort();

  const panel = selected && data ? <DetailPanel repoId={repo.id} node={selected} graph={data} onSelect={select} onExpand={expand} onShowSymbols={showSymbols} /> : null;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2 sm:px-4">
        <div role="radiogroup" aria-label="Atlas layout" className="flex gap-1 rounded-lg border border-border bg-surface-2 p-0.5">
          {MODES.map((m) => (
            <button key={m.id} type="button" role="radio" aria-checked={mode === m.id} title={m.help} onClick={() => setParams({ mode: m.id, node: null, file: null })} className={cn("flex cursor-pointer items-center gap-1.5 rounded-md px-2.5 py-1 text-[12.5px] max-md:py-2", mode === m.id ? "bg-surface-3 text-fg" : "text-fg-muted hover:text-fg")}>
              <m.icon className="size-3.5" aria-hidden />
              <span className="max-sm:sr-only">{m.label}</span>
            </button>
          ))}
        </div>
        <div className="relative min-w-[180px] flex-1 sm:max-w-xs">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-fg-subtle" aria-hidden />
          <Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Find files and symbols…" className="h-8 pl-8 text-[13px]" aria-label="Find files and symbols" />
          {lowered.length >= 2 && hits.length ? (
            <ul className="absolute left-0 right-0 top-9 z-20 max-h-72 overflow-auto rounded-lg border border-border bg-surface p-1 shadow-overlay" role="listbox" aria-label="Repository matches">
              {hits.map((h) => (
                <li key={`${h.type}-${h.id}`}>
                  <button type="button" role="option" aria-selected={false} onClick={() => jumpTo(h)} className="flex w-full cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-surface-2">
                    <span className="truncate font-mono">{h.type === "file" ? h.path : h.name}</span>
                    <span className="ml-auto shrink-0 text-[11px] text-fg-subtle">{h.type === "symbol" ? `${h.kind} · ${h.path.split("/").pop()}:${h.startLine}` : "file"}</span>
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <select aria-label="Filter by language" value={language} onChange={(e) => setParams({ lang: e.target.value || null, node: null })} className="h-8 cursor-pointer rounded-md border border-border-strong bg-surface-2 px-2 text-[13px] max-md:h-11">
          <option value="">All languages</option>
          {(data?.languages ?? []).map((l) => <option key={l} value={l}>{languageLabel(l)}</option>)}
        </select>
        {mode !== "architecture" ? (
          <select aria-label="Scope to folder" value={fileScope ? "" : dir} onChange={(e) => setParams({ dir: e.target.value || null, file: null, node: null })} className="h-8 max-w-44 cursor-pointer rounded-md border border-border-strong bg-surface-2 px-2 text-[13px] max-md:h-11">
            <option value="">{fileScope ? "Single file" : "Whole repository"}</option>
            {[...new Set(expanded.concat(topExpanded))].sort().map((d) => <option key={d} value={d}>{d}/</option>)}
          </select>
        ) : null}
        {mode === "dependencies" ? (
          <label className="flex cursor-pointer items-center gap-1.5 text-[12.5px] text-fg-muted">
            <input type="checkbox" checked={external} onChange={(e) => setParams({ ext: e.target.checked ? "1" : null })} className="accent-[var(--primary)]" /> Packages
          </label>
        ) : null}
        <div className="ml-auto flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={() => setView(view === "graph" ? "outline" : "graph")} aria-pressed={view === "outline"}>
            <ListTree /> {view === "graph" ? "Outline" : "Graph"}
          </Button>
          <Button size="sm" variant="ghost" onClick={() => flow.fitView({ padding: 0.15, duration: 250 })} aria-label="Fit graph to screen"><Maximize2 /></Button>
          <Button size="sm" variant="ghost" onClick={() => router.replace(pathname, { scroll: false })} aria-label="Reset Atlas"><RotateCcw /></Button>
        </div>
      </div>

      {/* Breadcrumb of expanded folders (architecture mode) */}
      {mode === "architecture" && expanded.length ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-border px-4 py-1.5 text-xs text-fg-muted">
          <span>Expanded:</span>
          {[...expanded].sort().map((e) => (
            <button key={e} type="button" onClick={() => collapseTo(e)} className="inline-flex cursor-pointer items-center gap-1 rounded bg-surface-2 px-1.5 py-0.5 font-mono hover:bg-surface-3 hover:text-fg" aria-label={`Collapse ${e}`}>
              {e}/ <X className="size-3" aria-hidden />
            </button>
          ))}
          <button type="button" className="ml-1 cursor-pointer text-primary hover:underline" onClick={() => collapseTo(null)}>Collapse all</button>
        </div>
      ) : null}
      {mode === "symbols" && fileScope ? (
        <div className="flex items-center gap-2 border-b border-border px-4 py-1.5 text-xs text-fg-muted">
          <ChevronRight className="size-3" aria-hidden /> Showing symbols of one file <button type="button" className="cursor-pointer text-primary hover:underline" onClick={() => setParams({ file: null })}>show whole repository</button>
        </div>
      ) : null}
      {data?.truncated ? (
        <Notice tone="warning" className="mx-4 mt-2" title={`Showing the ${data.nodes.length} most connected of ${data.totalCandidates} nodes`}>Filter by language or folder to see the rest.</Notice>
      ) : null}

      <div className="relative flex min-h-[420px] flex-1">
        <div className="relative min-w-0 flex-1" aria-describedby="atlas-help">
          <p id="atlas-help" className="sr-only">{modeInfo.help} Use the Outline view for a keyboard-friendly list of the same nodes and relationships.</p>
          {error ? (
            <div className="p-6"><Notice tone="danger" title="Couldn't build the Atlas" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>{error.message}</Notice></div>
          ) : isLoading && !data ? (
            <div className="grid h-full place-items-center p-6"><div className="w-full max-w-md space-y-3"><Skeleton className="h-12" /><Skeleton className="h-12 w-3/4" /><Skeleton className="h-12 w-1/2" /><p className="text-center text-xs text-fg-muted">Laying out the graph from indexed imports…</p></div></div>
          ) : data && data.nodes.length === 0 ? (
            <EmptyState icon={Network} title="Nothing to show with these filters">Try another language, folder, or layout.</EmptyState>
          ) : view === "outline" ? (
            <Outline data={data!} selectedId={selectedId} onSelect={select} onExpand={expand} />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              nodeTypes={nodeTypes}
              onNodeClick={(_, n) => select(n.id === selectedId ? null : n.id)}
              onNodeDoubleClick={(_, n) => {
                const d = n.data as AtlasNodeData;
                if (d.kind === "directory") expand(d.path);
              }}
              onPaneClick={() => selectedId && select(null)}
              nodesConnectable={false}
              nodesDraggable={false}
              minZoom={0.1}
              maxZoom={2}
              onlyRenderVisibleElements
              aria-label={`Codebase Atlas, ${modeInfo.label} layout`}
            >
              <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border-strong)" />
              <Controls showInteractive={false} position="bottom-left" />
              {desktop ? <MiniMap pannable zoomable nodeColor={(n) => ((n.data as AtlasNodeData).kind === "directory" ? "#64748b" : (n.data as AtlasNodeData).kind === "symbol" ? "#38bdf8" : "#6366f1")} maskColor="rgba(11,16,32,0.6)" /> : null}
            </ReactFlow>
          )}
          <Legend mode={mode} />
        </div>
        {desktop && panel ? <aside className="w-[380px] shrink-0 border-l border-border bg-surface" aria-label="Selected node details">{panel}</aside> : null}
      </div>
      {!desktop ? (
        <Sheet open={Boolean(panel)} onOpenChange={(o) => !o && select(null)} title={selected?.label ?? "Details"}>
          {panel}
        </Sheet>
      ) : null}
    </div>
  );
}

function Legend({ mode }: { mode: AtlasMode }) {
  const items = mode === "symbols" ? [{ k: { kind: "symbol" as const, symbolKind: "function" } }, { k: { kind: "symbol" as const, symbolKind: "class" } }, { k: { kind: "symbol" as const, symbolKind: "interface" } }] : [{ k: { kind: "directory" as const } }, { k: { kind: "file" as const } }, ...(mode === "dependencies" ? [{ k: { kind: "external" as const } }] : [])];
  return (
    <div className="pointer-events-none absolute right-3 top-3 hidden rounded-lg border border-border bg-surface/90 px-3 py-2 text-[11px] text-fg-muted backdrop-blur sm:block">
      <ul className="space-y-1">
        {items.map(({ k }) => {
          const s = kindStyle(k);
          return <li key={s.label} className="flex items-center gap-1.5"><s.icon className={`size-3.5 ${s.tone}`} aria-hidden /> {s.label}</li>;
        })}
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-primary" /> {mode === "symbols" ? "calls" : "depends on"}</li>
        <li className="flex items-center gap-1.5"><span className="h-0.5 w-4 bg-incoming" /> {mode === "symbols" ? "called by" : "used by"}</li>
      </ul>
    </div>
  );
}

/** Keyboard-first equivalent of the graph: every node with its relationships. */
function Outline({ data, selectedId, onSelect, onExpand }: { data: GraphData; selectedId: string | null; onSelect: (id: string) => void; onExpand: (p: string) => void }) {
  const byId = new Map(data.nodes.map((n) => [n.id, n]));
  const sorted = [...data.nodes].sort((a, b) => (a.kind === b.kind ? (a.path || a.label).localeCompare(b.path || b.label) : a.kind === "directory" ? -1 : 1));
  const outOf = (n: GraphNode) => data.edges.filter((e) => e.source === n.id).map((e) => byId.get(e.target)?.label).filter(Boolean);
  return (
    <div className="h-full overflow-auto p-3">
      <table className="w-full text-left text-[13px]">
        <caption className="sr-only">Nodes and their outgoing relationships</caption>
        <thead className="text-[11px] uppercase tracking-wider text-fg-subtle">
          <tr><th className="px-2 py-1.5 font-medium">Node</th><th className="px-2 py-1.5 font-medium">Type</th><th className="px-2 py-1.5 font-medium">In / Out</th><th className="px-2 py-1.5 font-medium max-md:hidden">Depends on</th></tr>
        </thead>
        <tbody>
          {sorted.map((n) => {
            const k = kindStyle(n);
            return (
              <tr key={n.id} className={cn("border-t border-border", selectedId === n.id && "bg-primary-soft")}>
                <td className="px-2 py-1.5">
                  <button type="button" onClick={() => onSelect(n.id)} className="flex cursor-pointer items-center gap-2 text-left font-mono hover:text-primary" aria-pressed={selectedId === n.id}>
                    <k.icon className={`size-3.5 shrink-0 ${k.tone}`} aria-hidden />
                    {n.kind === "symbol" ? n.label : n.path}
                  </button>
                  {n.kind === "directory" ? <button type="button" onClick={() => onExpand(n.path)} className="ml-5 cursor-pointer text-xs text-primary hover:underline">expand</button> : null}
                </td>
                <td className="px-2 py-1.5 text-fg-muted">{k.label}</td>
                <td className="px-2 py-1.5 font-mono text-fg-muted">{n.inDegree} / {n.outDegree}</td>
                <td className="max-w-md truncate px-2 py-1.5 font-mono text-xs text-fg-muted max-md:hidden">{outOf(n).join(", ") || "—"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export function AtlasView() {
  return (
    <ReactFlowProvider>
      <AtlasInner />
    </ReactFlowProvider>
  );
}
