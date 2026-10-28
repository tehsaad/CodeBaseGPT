import dagre from "@dagrejs/dagre";
import type { GraphData } from "./types";

export const NODE_HEIGHT = 58;

export function nodeWidth(label: string) {
  return Math.min(280, Math.max(150, label.length * 7.4 + 64));
}

/**
 * Layered layout for connected nodes (dependencies flow left→right), with unconnected nodes
 * (configs, docs, leaf folders) packed into a grid underneath so they don't stretch the graph.
 */
export function layoutGraph(data: GraphData, direction: "LR" | "TB") {
  const connected = new Set<string>();
  for (const e of data.edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const positions = new Map<string, { x: number; y: number }>();
  const linked = data.nodes.filter((n) => connected.has(n.id));
  const isolated = data.nodes.filter((n) => !connected.has(n.id)).sort((a, b) => (a.kind === b.kind ? a.label.localeCompare(b.label) : a.kind === "directory" ? -1 : 1));

  let maxY = 0;
  let minX = 0;
  let maxX = 0;
  if (linked.length) {
    const g = new dagre.graphlib.Graph();
    g.setGraph({ rankdir: direction, nodesep: 18, ranksep: direction === "LR" ? 90 : 70, marginx: 20, marginy: 20 });
    g.setDefaultEdgeLabel(() => ({}));
    for (const n of linked) g.setNode(n.id, { width: nodeWidth(n.label), height: NODE_HEIGHT });
    for (const e of data.edges) g.setEdge(e.source, e.target);
    dagre.layout(g);
    minX = Infinity;
    for (const n of linked) {
      const p = g.node(n.id);
      const pos = { x: p.x - nodeWidth(n.label) / 2, y: p.y - NODE_HEIGHT / 2 };
      positions.set(n.id, pos);
      maxY = Math.max(maxY, pos.y + NODE_HEIGHT);
      minX = Math.min(minX, pos.x);
      maxX = Math.max(maxX, pos.x + nodeWidth(n.label));
    }
  }

  if (isolated.length) {
    const cellW = 250;
    const width = Math.max(maxX - minX, cellW * 3);
    const cols = Math.max(2, Math.min(direction === "LR" ? 6 : 2, Math.floor(width / cellW)));
    const top = linked.length ? maxY + 60 : 20;
    isolated.forEach((n, i) => {
      positions.set(n.id, { x: (linked.length ? minX : 20) + (i % cols) * cellW, y: top + Math.floor(i / cols) * (NODE_HEIGHT + 16) });
    });
  }
  return positions;
}
