"use client";
import { Handle, Position, type NodeProps } from "@xyflow/react";
import { Box, Braces, FileCode2, Folder, Package, Shapes, Type } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/client/cn";
import type { GraphNode } from "./types";

export type AtlasNodeData = GraphNode & { state: "default" | "selected" | "incoming" | "outgoing" | "dimmed" | "match"; direction: "LR" | "TB" };

export function kindStyle(n: Pick<GraphNode, "kind" | "symbolKind">) {
  if (n.kind === "directory") return { icon: Folder, label: "Folder", tone: "text-fg-muted", shape: "rounded-xl" };
  if (n.kind === "external") return { icon: Package, label: "Package", tone: "text-fg-subtle", shape: "rounded-md border-dashed" };
  if (n.kind === "file") return { icon: FileCode2, label: "File", tone: "text-primary", shape: "rounded-md" };
  if (n.symbolKind === "class" || n.symbolKind === "struct") return { icon: Box, label: n.symbolKind === "struct" ? "Struct" : "Class", tone: "text-accent", shape: "rounded-md" };
  if (n.symbolKind === "interface" || n.symbolKind === "type" || n.symbolKind === "enum") return { icon: Type, label: n.symbolKind, tone: "text-warning", shape: "rounded-md" };
  if (n.symbolKind === "namespace") return { icon: Shapes, label: "Namespace", tone: "text-fg-muted", shape: "rounded-xl" };
  return { icon: Braces, label: n.symbolKind === "method" ? "Method" : "Function", tone: "text-info", shape: "rounded-full" };
}

function meta(d: GraphNode) {
  if (d.kind === "directory") return `${d.files} files · ${d.lines?.toLocaleString()} lines`;
  if (d.kind === "file") return `${d.lines?.toLocaleString()} lines · ${d.symbols} symbols`;
  if (d.kind === "symbol") return `${d.path.split("/").pop()}:${d.startLine}`;
  return "external dependency";
}

export const AtlasNode = memo(function AtlasNode({ data }: NodeProps) {
  const d = data as AtlasNodeData;
  const k = kindStyle(d);
  const Icon = k.icon;
  const horizontal = d.direction === "LR";
  return (
    <div
      className={cn(
        "flex h-[58px] items-center gap-2.5 border bg-surface px-3 shadow-sm transition-[opacity,border-color,box-shadow] duration-150",
        k.shape,
        d.state === "selected" && "border-primary ring-2 ring-primary/40",
        d.state === "outgoing" && "border-primary/70",
        d.state === "incoming" && "border-incoming/80",
        d.state === "match" && "border-accent ring-2 ring-accent/30",
        d.state === "default" && "border-border-strong",
        d.state === "dimmed" && "border-border opacity-30",
      )}
      title={d.path}
    >
      <Handle type="target" position={horizontal ? Position.Left : Position.Top} className="!size-1.5 !border-0 !bg-fg-subtle" />
      <Icon className={cn("size-4 shrink-0", k.tone)} aria-hidden />
      <div className="min-w-0 flex-1">
        <div className="truncate font-mono text-[12.5px] font-medium text-fg">{d.label}</div>
        <div className="truncate text-[11px] text-fg-subtle">{meta(d)}</div>
      </div>
      {d.inDegree || d.outDegree ? (
        <div className="flex shrink-0 flex-col items-end font-mono text-[10px] leading-tight text-fg-subtle" aria-label={`${d.inDegree} incoming, ${d.outDegree} outgoing`}>
          <span title="incoming">↘{d.inDegree}</span>
          <span title="outgoing">↗{d.outDegree}</span>
        </div>
      ) : null}
      <Handle type="source" position={horizontal ? Position.Right : Position.Bottom} className="!size-1.5 !border-0 !bg-fg-subtle" />
    </div>
  );
});
