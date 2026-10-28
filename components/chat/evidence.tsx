"use client";
import { FileCode2, Globe } from "lucide-react";
import type { EvidenceItem, WebItem } from "@/lib/ai/types";
import { cn } from "@/lib/client/cn";

const REASON: Record<string, string> = {
  focus: "selected by you",
  lexical: "text match",
  semantic: "semantic match",
  "call-site": "call site",
  dependent: "imports focused file",
  definition: "definition",
};

export function EvidenceList({ items, used, onOpen, compact }: { items: EvidenceItem[]; used?: Set<string>; onOpen: (e: EvidenceItem) => void; compact?: boolean }) {
  if (!items.length) return <p className="text-[13px] text-fg-muted">No repository code was retrieved.</p>;
  return (
    <ul className="space-y-1.5">
      {items.map((e) => (
        <li key={e.label}>
          <button type="button" onClick={() => onOpen(e)} className={cn("group w-full cursor-pointer rounded-md border border-l-2 border-border border-l-primary bg-surface-2/60 px-2.5 py-2 text-left hover:border-border-strong hover:bg-surface-2", used && !used.has(e.label) && "opacity-70")}>
            <div className="flex items-center gap-2">
              <span className="rounded bg-primary-soft px-1 font-mono text-[11px] font-medium text-primary">{e.label}</span>
              <FileCode2 className="size-3.5 shrink-0 text-fg-subtle" aria-hidden />
              <span className="min-w-0 flex-1 truncate font-mono text-[12.5px] group-hover:text-primary">{e.path}<span className="text-fg-subtle">:{e.startLine}{e.endLine !== e.startLine ? `–${e.endLine}` : ""}</span></span>
            </div>
            <div className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-fg-subtle">
              {e.symbol ? <span className="font-mono">{e.symbol}</span> : null}
              <span>{REASON[e.reason] ?? e.reason}</span>
              {used ? <span className={used.has(e.label) ? "text-success" : ""}>{used.has(e.label) ? "cited in answer" : "not cited"}</span> : null}
            </div>
            {!compact ? <pre className="mt-1.5 max-h-24 overflow-hidden whitespace-pre-wrap font-mono text-[11.5px] leading-snug text-fg-muted">{e.preview.split("\n").slice(0, 5).join("\n")}</pre> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

export function WebList({ items, used, onSave, savedIds }: { items: WebItem[]; used?: Set<string>; onSave?: (w: WebItem) => void; savedIds?: Set<string> }) {
  if (!items.length) return null;
  return (
    <ul className="space-y-1.5">
      {items.map((w) => (
        <li key={w.label} className="rounded-md border border-l-2 border-border border-l-info bg-surface-2/60 px-2.5 py-2">
          <div className="flex items-start gap-2">
            <span className="mt-0.5 rounded bg-info-soft px-1 font-mono text-[11px] font-medium text-info">{w.label}</span>
            <div className="min-w-0 flex-1">
              <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="line-clamp-2 text-[13px] font-medium hover:text-info hover:underline">{w.title}</a>
              <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-[11px] text-fg-subtle">
                <Globe className="size-3" aria-hidden /> {w.domain}
                {w.publishedAt ? <span>· {w.publishedAt}</span> : null}
                {used ? <span className={used.has(w.label) ? "text-success" : ""}>{used.has(w.label) ? "· cited" : "· not cited"}</span> : null}
              </p>
              {w.snippet ? <p className="mt-1 line-clamp-3 text-[12px] text-fg-muted">{w.snippet}</p> : null}
            </div>
            {onSave && w.id ? (
              <button type="button" onClick={() => onSave(w)} className="shrink-0 cursor-pointer rounded px-1.5 py-0.5 text-[11px] text-fg-muted hover:bg-surface-3 hover:text-fg" aria-pressed={savedIds?.has(w.id)}>
                {savedIds?.has(w.id) ? "Saved" : "Save"}
              </button>
            ) : null}
          </div>
        </li>
      ))}
    </ul>
  );
}
