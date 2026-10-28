"use client";
import { Background, BackgroundVariant, MarkerType, ReactFlow, ReactFlowProvider, type Edge, type Node } from "@xyflow/react";
import { FileCode2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";
import { AtlasNode, type AtlasNodeData } from "@/components/atlas/atlas-node";
import { layoutGraph } from "@/components/atlas/layout";
import type { GraphData, GraphNode } from "@/components/atlas/types";
import { Badge } from "@/components/ui/misc";

// Sample data: the dependency graph CodeBaseGPT extracts from tests/fixtures/sample-repo
// (asserted by tests/integration/pipeline.test.ts). Shown on the landing page only.
const f = (path: string, lines: number, symbols: number, inDegree: number, outDegree: number, language = "typescript"): GraphNode => ({ id: `file:${path}`, kind: "file", label: path.split("/").pop()!, path, language, lines, symbols, inDegree, outDegree });
const SAMPLE: GraphData = {
  mode: "architecture",
  truncated: false,
  totalCandidates: 7,
  languages: ["typescript", "javascript"],
  nodes: [
    f("src/api/login.ts", 9, 1, 0, 1),
    f("src/api/tasks.js", 17, 3, 0, 1, "javascript"),
    f("src/auth/session.ts", 33, 4, 2, 2),
    f("src/auth/password.ts", 10, 1, 1, 0),
    f("src/lib/db.ts", 11, 2, 1, 0),
    { id: "dir:py", kind: "directory", label: "py/", path: "py", files: 3, lines: 21, symbols: 5, inDegree: 0, outDegree: 0 },
    { id: "dir:native", kind: "directory", label: "native/", path: "native", files: 3, lines: 31, symbols: 5, inDegree: 0, outDegree: 0 },
  ],
  edges: [
    { id: "a", source: "file:src/api/login.ts", target: "file:src/auth/session.ts", weight: 1, kind: "import" },
    { id: "b", source: "file:src/api/tasks.js", target: "file:src/auth/session.ts", weight: 1, kind: "import" },
    { id: "c", source: "file:src/auth/session.ts", target: "file:src/auth/password.ts", weight: 1, kind: "import" },
    { id: "d", source: "file:src/auth/session.ts", target: "file:src/lib/db.ts", weight: 1, kind: "import" },
  ],
};

const nodeTypes = { cbg: AtlasNode };

function Inner() {
  const [selected, setSelected] = useState<string | null>("file:src/auth/session.ts");
  const pos = useMemo(() => layoutGraph(SAMPLE, "LR"), []);
  const nodes: Node<AtlasNodeData>[] = SAMPLE.nodes.map((n) => {
    const out = SAMPLE.edges.some((e) => e.source === selected && e.target === n.id);
    const inc = SAMPLE.edges.some((e) => e.target === selected && e.source === n.id);
    const state = !selected ? "default" : n.id === selected ? "selected" : out ? "outgoing" : inc ? "incoming" : "dimmed";
    return { id: n.id, type: "cbg", position: pos.get(n.id)!, data: { ...n, state, direction: "LR" }, draggable: false };
  });
  const edges: Edge[] = SAMPLE.edges.map((e) => {
    const color = e.source === selected ? "var(--primary)" : e.target === selected ? "var(--incoming)" : "var(--fg-subtle)";
    return { id: e.id, source: e.source, target: e.target, markerEnd: { type: MarkerType.ArrowClosed, color }, style: { stroke: color, strokeWidth: 1.6, opacity: selected && e.source !== selected && e.target !== selected ? 0.2 : 1 } };
  });
  return (
    <div className="grid overflow-hidden rounded-[14px] border border-border bg-surface lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="relative h-[340px] border-b border-border lg:h-[420px] lg:border-b-0 lg:border-r">
        <div className="absolute left-3 top-3 z-10 flex items-center gap-2">
          <Badge tone="warning">Sample data</Badge>
          <span className="text-[11px] text-fg-subtle">demo “taskboard” repo · click a file</span>
        </div>
        <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView fitViewOptions={{ padding: 0.2 }} onNodeClick={(_, n) => setSelected(n.id === selected ? null : n.id)} onPaneClick={() => setSelected(null)} nodesConnectable={false} nodesDraggable={false} zoomOnScroll={false} preventScrolling={false} proOptions={{ hideAttribution: true }} aria-label="Sample Codebase Atlas">
          <Background variant={BackgroundVariant.Dots} gap={22} size={1} color="var(--border-strong)" />
        </ReactFlow>
      </div>
      <div className="space-y-3 p-4 text-[13px]">
        <p className="flex items-center gap-1.5 text-xs text-fg-subtle"><Sparkles className="size-3.5 text-accent" aria-hidden /> Example answer · illustrative</p>
        <p className="rounded-lg bg-surface-3 px-3 py-2">How does sign-in work?</p>
        <p className="leading-relaxed text-fg-muted">
          <span className="text-fg">signIn</span> looks the user up with <span className="font-mono text-fg">findUserByEmail</span>, checks the password with <span className="font-mono text-fg">verifyPassword</span>, then signs a session token
          <span className="mx-1 rounded border border-primary/40 bg-primary-soft px-1 font-mono text-[11px] text-primary">C1</span>.
          Tokens are verified with an HMAC comparison and an expiry check
          <span className="mx-1 rounded border border-primary/40 bg-primary-soft px-1 font-mono text-[11px] text-primary">C2</span>.
        </p>
        <ul className="space-y-1.5">
          {[
            ["C1", "src/auth/session.ts", "28–32"],
            ["C2", "src/auth/session.ts", "16–24"],
          ].map(([l, p, r]) => (
            <li key={l} className="flex items-center gap-2 rounded-md border border-l-2 border-border border-l-primary bg-surface-2/60 px-2.5 py-1.5">
              <span className="rounded bg-primary-soft px-1 font-mono text-[11px] text-primary">{l}</span>
              <FileCode2 className="size-3.5 text-fg-subtle" aria-hidden />
              <span className="truncate font-mono text-xs">{p}<span className="text-fg-subtle">:{r}</span></span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

export function SampleAtlas() {
  return (
    <ReactFlowProvider>
      <Inner />
    </ReactFlowProvider>
  );
}
