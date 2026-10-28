"use client";
import { Check, Play, Undo2, Wand2 } from "lucide-react";
import { useMemo } from "react";
import { cn } from "@/lib/client/cn";
import { lineDiff } from "@/lib/client/fix";
import { Button } from "@/components/ui/button";

/** Shows the tutor's proposed fix as a diff against the editor; nothing changes until the student approves. */
export function FixProposal({ current, proposed, applied, onApply, onApplyAndRun, onUndo, busy }: { current: string; proposed: string; applied: boolean; onApply: () => void; onApplyAndRun: () => void; onUndo: () => void; busy: boolean }) {
  const diff = useMemo(() => lineDiff(current, proposed), [current, proposed]);
  if (applied) {
    return (
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-success/30 bg-success/8 p-3 text-[13px]">
        <Check className="size-4 text-success" aria-hidden /> The tutor&apos;s fix is in the editor. Run it to verify — the result above is the only proof it works.
        <Button size="sm" variant="ghost" className="ml-auto" onClick={onUndo}><Undo2 /> Undo</Button>
      </div>
    );
  }
  if (!diff.added && !diff.removed) return null;
  return (
    <section className="rounded-lg border border-border" aria-label="Proposed fix">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-3 py-2">
        <Wand2 className="size-4 text-accent" aria-hidden />
        <h3 className="text-[13px] font-semibold">Proposed fix</h3>
        <span className="font-mono text-[11.5px] text-success">+{diff.added}</span>
        <span className="font-mono text-[11.5px] text-danger">−{diff.removed}</span>
        <span className="text-[11px] text-fg-subtle">AI suggestion · not yet run</span>
        <div className="ml-auto flex gap-1.5">
          <Button size="sm" onClick={onApply} disabled={busy}>Apply to editor</Button>
          <Button size="sm" variant="primary" onClick={onApplyAndRun} disabled={busy}><Play /> Apply &amp; run</Button>
        </div>
      </div>
      <pre className="max-h-72 overflow-auto bg-code py-1 font-mono text-[12px] leading-relaxed">
        {diff.lines.map((l, i) => (
          <div key={i} className={cn("flex px-2", l.kind === "add" && "bg-success/12", l.kind === "del" && "bg-danger/12")}>
            <span className="w-8 shrink-0 select-none text-right text-fg-subtle">{l.oldNo ?? ""}</span>
            <span className="w-8 shrink-0 select-none text-right text-fg-subtle">{l.newNo ?? ""}</span>
            <span className={cn("w-5 shrink-0 select-none text-center", l.kind === "add" ? "text-success" : l.kind === "del" ? "text-danger" : "text-fg-subtle")} aria-label={l.kind === "add" ? "added" : l.kind === "del" ? "removed" : undefined}>{l.kind === "add" ? "+" : l.kind === "del" ? "−" : " "}</span>
            <span className="whitespace-pre-wrap break-words">{l.text}</span>
          </div>
        ))}
      </pre>
    </section>
  );
}
