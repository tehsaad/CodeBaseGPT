export type GraphNode = {
  id: string;
  kind: "directory" | "file" | "symbol" | "external";
  label: string;
  path: string;
  fileId?: string;
  symbolId?: string;
  symbolKind?: string;
  language?: string | null;
  lines?: number;
  files?: number;
  symbols?: number;
  startLine?: number;
  endLine?: number;
  inDegree: number;
  outDegree: number;
  expandable?: boolean;
};

export type GraphEdge = { id: string; source: string; target: string; weight: number; kind: "import" | "call" };

export type GraphData = {
  mode: "architecture" | "dependencies" | "symbols";
  nodes: GraphNode[];
  edges: GraphEdge[];
  truncated: boolean;
  totalCandidates: number;
  languages: string[];
};

export type AtlasMode = GraphData["mode"];
