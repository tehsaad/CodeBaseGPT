"use client";
import { FileArchive, FolderGit2, Trash2 } from "lucide-react";
import Link from "next/link";
import { GitHubIcon } from "@/components/brand/github-icon";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import useSWR from "swr";
import { api, fetcher, type Repository } from "@/lib/client/api";
import { forgetRepo } from "@/lib/client/last-repo";
import { nf, relativeTime } from "@/lib/client/format";
import { Button } from "@/components/ui/button";
import { EmptyState, Notice, Panel, SectionHeader, Skeleton } from "@/components/ui/misc";
import { ImportForm } from "./import-form";
import { RepoStatusBadge } from "./status";

const SECTION_LABEL: Record<string, string> = { atlas: "Codebase Atlas", ask: "Ask CodeBaseGPT", stuck: "Stuck Mode", insights: "Insights", source: "Source files" };

export function RepoListPage() {
  const params = useSearchParams();
  const pick = params.get("pick");
  const section = pick && SECTION_LABEL[pick] ? pick : null;
  const { data, error, isLoading, mutate } = useSWR<{ repositories: Repository[] }>("/api/repos?limit=50", fetcher);
  const [deleting, setDeleting] = useState<string | null>(null);

  async function remove(repo: Repository) {
    if (!window.confirm(`Remove ${repo.fullName} and all of its indexed data, conversations and citations? This can't be undone.`)) return;
    setDeleting(repo.id);
    try {
      await api(`/api/repos/${repo.id}`, { method: "DELETE" });
      forgetRepo(repo.id);
      await mutate();
    } finally {
      setDeleting(null);
    }
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeader title="Repositories" description="Import a codebase to explore it in the Atlas, ask cited questions, and get unstuck." />
      {section ? <Notice tone="info" title={`Choose a repository to open ${SECTION_LABEL[section]}`} /> : null}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-6 lg:grid-cols-[minmax(0,1fr)_380px]">
        <Panel className="min-w-0">
          <div className="border-b border-border px-4 py-3 text-sm font-medium">Your repositories</div>
          {error ? (
            <div className="p-4">
              <Notice tone="danger" title="Couldn't load repositories" action={<Button size="sm" onClick={() => mutate()}>Retry</Button>}>
                {error.message}
              </Notice>
            </div>
          ) : isLoading ? (
            <div className="space-y-2 p-4">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-14" />)}</div>
          ) : !data?.repositories.length ? (
            <EmptyState icon={FolderGit2} title="No repositories yet">
              Import a public GitHub repository or upload a ZIP to build its Atlas.
            </EmptyState>
          ) : (
            <ul className="divide-y divide-border">
              {data.repositories.map((r) => (
                <li key={r.id} className="flex items-center gap-3 px-4 py-3">
                  <span className="grid size-9 shrink-0 place-items-center rounded-md bg-surface-2 text-fg-muted">
                    {r.source === "github" ? <GitHubIcon /> : <FileArchive className="size-4" aria-hidden />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <Link href={`/repos/${r.id}${section ? `/${section}` : ""}`} className="block truncate font-mono text-[13.5px] font-medium hover:text-primary">
                      {r.fullName}
                    </Link>
                    <p className="mt-0.5 truncate text-xs text-fg-muted">
                      {nf.format(r.fileCount)} files · {nf.format(r.symbolCount)} symbols · {r.ref ? `${r.ref} · ` : ""}indexed {relativeTime(r.lastIndexedAt)}
                    </p>
                  </div>
                  <RepoStatusBadge status={r.status} />
                  <Button variant="ghost" size="icon" aria-label={`Remove ${r.fullName}`} loading={deleting === r.id} onClick={() => remove(r)}>
                    {deleting === r.id ? null : <Trash2 />}
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>
        <Panel className="h-fit p-4">
          <h2 className="mb-3 text-sm font-semibold">Import a repository</h2>
          <ImportForm onImported={() => mutate()} next={section ?? undefined} />
        </Panel>
      </div>
    </div>
  );
}
