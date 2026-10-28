"use client";
import { RotateCcw, Square } from "lucide-react";
import { useState } from "react";
import { api, ClientApiError } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/misc";
import { useRepo } from "./repo-context";
import { isIndexing } from "./status";

const PHASES = [
  { key: "download", label: "Download & filter" },
  { key: "parse", label: "Parse symbols" },
  { key: "link", label: "Resolve imports & calls" },
  { key: "embed", label: "Embeddings (optional)" },
] as const;

export function IndexingProgress() {
  const { repo, job, refresh } = useRepo();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const indexing = isIndexing(repo.status);
  const phaseIdx = job ? PHASES.findIndex((p) => p.key === job.phase) : -1;
  const pct = job && job.phase === "parse" && job.total > 0 ? Math.min(100, Math.round((job.processed / job.total) * 100)) : null;

  async function act(action: "cancel" | "reindex") {
    setBusy(action);
    setError(null);
    try {
      await api(`/api/repos/${repo.id}/index`, { method: "POST", body: JSON.stringify({ action }) });
      await refresh();
    } catch (e) {
      setError(e instanceof ClientApiError ? e.message : "Request failed");
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3">
      {indexing ? (
        <div>
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">{job ? PHASES[Math.max(0, phaseIdx)]?.label : "Starting…"}</span>
            {pct !== null ? <span className="font-mono text-xs text-fg-muted">{job!.processed}/{job!.total} files · {pct}%</span> : null}
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-3" role="progressbar" aria-label="Indexing progress" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct ?? undefined}>
            <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct ?? (phaseIdx >= 2 ? 92 : 8)}%` }} />
          </div>
          <ol className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs">
            {PHASES.map((p, i) => (
              <li key={p.key} className={i < phaseIdx ? "text-success" : i === phaseIdx ? "text-fg" : "text-fg-subtle"}>
                {i < phaseIdx ? "✓ " : i === phaseIdx ? "● " : "○ "}
                {p.label}
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-fg-muted">Indexing continues in the background and resumes automatically when you revisit this page.</p>
        </div>
      ) : null}
      {repo.status === "failed" ? <Notice tone="danger" title="Indexing failed">{repo.error ?? "Unknown error"}</Notice> : null}
      {repo.status === "cancelled" ? <Notice tone="warning" title="Indexing was cancelled">Re-index to build the Atlas and enable questions.</Notice> : null}
      {job?.status === "succeeded" && job.error ? <Notice tone="info" title="Indexed without embeddings">{job.error}. Lexical search and the Atlas still work.</Notice> : null}
      {error ? <Notice tone="danger" title={error} /> : null}
      <div className="flex flex-wrap gap-2">
        {indexing ? (
          <Button size="sm" onClick={() => act("cancel")} loading={busy === "cancel"}><Square /> Cancel</Button>
        ) : (
          <Button size="sm" onClick={() => act("reindex")} loading={busy === "reindex"}><RotateCcw /> {repo.status === "ready" ? (repo.source === "github" ? "Re-index latest commit" : "Re-index") : "Retry indexing"}</Button>
        )}
      </div>
    </div>
  );
}
