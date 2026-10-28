import dagre from "@dagrejs/dagre";
import type { GraphData } from "./types";

export const NODE_HEIGHT = 58;

export function nodeWidth(label: string) {
  return Math.min(280, Math.max(150, label.length * 7.4 + 64));
}

/** Layered layout (dependencies flow left→right), computed client-side; bounded to ≤ 400 nodes by the API. */
export function layoutGraph(data: GraphData, direction: "LR" | "TB") {
  const g = new dagre.graphlib.Graph();
  g.setGraph({ rankdir: direction, nodesep: 18, ranksep: direction === "LR" ? 90 : 70, marginx: 20, marginy: 20 });
  g.setDefaultEdgeLabel(() => ({}));
  for (const n of data.nodes) g.setNode(n.id, { width: nodeWidth(n.label), height: NODE_HEIGHT });
  for (const e of data.edges) g.setEdge(e.source, e.target);
  dagre.layout(g);
  const positions = new Map<string, { x: number; y: number }>();
  for (const n of data.nodes) {
    const p = g.node(n.id);
    positions.set(n.id, { x: p.x - nodeWidth(n.label) / 2, y: p.y - NODE_HEIGHT / 2 });
  }
  return positions;
}
