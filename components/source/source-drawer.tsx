"use client";
import { createContext, use, useCallback, useState, type ReactNode } from "react";
import { Sheet } from "@/components/ui/sheet";
import { SourcePanel } from "./source-viewer";

type Target = { fileId: string; startLine?: number; endLine?: number; title?: string };
const Ctx = createContext<{ openSource: (t: Target) => void } | null>(null);

export function useSourceDrawer() {
  const ctx = use(Ctx);
  if (!ctx) throw new Error("useSourceDrawer requires SourceDrawerProvider");
  return ctx;
}

/** Opens cited source in place, so chat / research / Atlas context is preserved. */
export function SourceDrawerProvider({ repoId, children }: { repoId: string; children: ReactNode }) {
  const [target, setTarget] = useState<Target | null>(null);
  const openSource = useCallback((t: Target) => setTarget(t), []);
  const range = target?.startLine ? { start: target.startLine, end: target.endLine ?? target.startLine } : undefined;
  return (
    <Ctx value={{ openSource }}>
      {children}
      <Sheet open={Boolean(target)} onOpenChange={(o) => !o && setTarget(null)} title={target?.title ?? "Source"} description={range ? `Lines ${range.start}–${range.end}` : undefined}>
        {target ? <SourcePanel repoId={repoId} fileId={target.fileId} range={range} compact /> : null}
      </Sheet>
    </Ctx>
  );
}
