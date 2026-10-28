"use client";
import { BarChart3, LifeBuoy, MessageSquareText, Network } from "lucide-react";
import Link from "next/link";
import { languageLabel } from "@/lib/code-intelligence/languages";
import { bytes, nf, relativeTime } from "@/lib/client/format";
import { Panel } from "@/components/ui/misc";
import { IndexingProgress } from "./indexing-progress";
import { useRepo } from "./repo-context";

const ACTIONS = [
  { seg: "atlas", icon: Network, title: "Explore the Atlas", body: "Folders, files and symbols as an interactive dependency map." },
  { seg: "ask", icon: MessageSquareText, title: "Ask with citations", body: "Gemma answers from retrieved code, with clickable file:line sources." },
  { seg: "stuck", icon: LifeBuoy, title: "I'm stuck", body: "Paste an error: we find related code and search the web for you." },
  { seg: "insights", icon: BarChart3, title: "Insights", body: "Measured languages, hotspots, cycles and complex functions." },
];

export function RepoOverview() {
  const { repo } = useRepo();
  const stats = [
    { label: "Files indexed", value: nf.format(repo.fileCount) },
    { label: "Lines", value: nf.format(repo.totalLines) },
    { label: "Symbols", value: nf.format(repo.symbolCount) },
    { label: "Import edges", value: nf.format(repo.edgeCount) },
    { label: "Skipped files", value: nf.format(repo.skippedCount) },
    { label: "Size", value: bytes(repo.totalBytes) },
  ];
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Index</h2>
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 sm:grid-cols-3">
            {stats.map((s) => (
              <div key={s.label}>
                <dt className="text-xs text-fg-muted">{s.label}</dt>
                <dd className="font-mono text-lg">{s.value}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-4 text-xs text-fg-muted">
            Last indexed {relativeTime(repo.lastIndexedAt)}
            {repo.manifest?.frameworks.length ? <> · Detected: {repo.manifest.frameworks.join(", ")}</> : null}
            {repo.manifest?.ecosystems.length ? <> · {repo.manifest.ecosystems.join(", ")}</> : null}
          </p>
        </Panel>
        <Panel className="p-4">
          <h2 className="mb-3 text-sm font-semibold">Indexing</h2>
          <IndexingProgress />
        </Panel>
      </div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {ACTIONS.map((a) => (
          <Link key={a.seg} href={`/repos/${repo.id}/${a.seg}`} className="group rounded-[10px] border border-border bg-surface p-4 transition-colors hover:border-border-strong hover:bg-surface-2">
            <a.icon className="size-5 text-primary" aria-hidden />
            <h3 className="mt-3 text-sm font-semibold group-hover:text-primary">{a.title}</h3>
            <p className="mt-1 text-[13px] text-fg-muted">{a.body}</p>
          </Link>
        ))}
      </div>
      <p className="text-xs text-fg-subtle">
        Symbol extraction supports {["typescript", "javascript", "python", "java", "c", "cpp"].map(languageLabel).join(", ")}. Other text files are searchable but have no symbols.
      </p>
    </div>
  );
}
