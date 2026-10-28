"use client";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { CbgDataParts } from "@/lib/ai/types";

const LABEL: Record<CbgDataParts["progress"]["phase"], string> = {
  waiting: "Sending the evidence to",
  thinking: "Reasoning before answering —",
  writing: "Writing —",
  retrying: "First model didn't respond; retrying with",
};

/** Live status while the model works. Gemma 4 reasons silently for 15–60 s before writing. */
export function ThinkingIndicator({ progress }: { progress: CbgDataParts["progress"] | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (!progress) {
    return (
      <p className="flex items-center gap-2 text-[13px] text-fg-muted" role="status">
        <Loader2 className="size-4 animate-spin text-accent" aria-hidden /> Retrieving evidence…
      </p>
    );
  }
  const seconds = Math.max(0, Math.round((now - progress.startedAt) / 1000));
  return (
    <div className="rounded-lg border border-accent/30 bg-accent-soft px-3 py-2 text-[13px]" role="status" aria-live="polite">
      <p className="flex items-center gap-2 text-fg">
        <Loader2 className="size-4 animate-spin text-accent" aria-hidden />
        {LABEL[progress.phase]} <span className="font-mono">{progress.model}</span>
        <span className="ml-auto font-mono text-xs text-fg-muted">{seconds}s</span>
      </p>
      {progress.phase === "thinking" || progress.phase === "waiting" ? (
        <p className="mt-1 pl-6 text-xs text-fg-muted">Gemma 4 thinks before it answers. This usually takes 15–60 seconds; the answer streams in as soon as it starts writing.</p>
      ) : null}
    </div>
  );
}
