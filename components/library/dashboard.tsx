"use client";
import { CheckCircle2, CircleAlert, FolderGit2, LifeBuoy, MessageSquareText, Network } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { authClient } from "@/lib/auth/client";
import { fetcher, type Repository } from "@/lib/client/api";
import { nf, relativeTime } from "@/lib/client/format";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel, SectionHeader, Skeleton } from "@/components/ui/misc";
import { ImportForm } from "@/components/repos/import-form";
import { RepoStatusBadge } from "@/components/repos/status";
import { useProviderStatus } from "@/components/chat/use-status";

type Convo = { id: string; title: string; kind: "chat" | "stuck"; repositoryId: string; repositoryName: string; updatedAt: string };

function StatusRow({ ok, label, detail }: { ok: boolean; label: string; detail: string }) {
  return (
    <li className="flex items-start gap-2.5 py-2">
      {ok ? <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-success" aria-hidden /> : <CircleAlert className="mt-0.5 size-4 shrink-0 text-warning" aria-hidden />}
      <div className="min-w-0">
        <p className="text-[13px] font-medium">{label} <span className="sr-only">{ok ? "configured" : "not configured"}</span></p>
        <p className="break-words text-xs text-fg-muted">{detail}</p>
      </div>
    </li>
  );
}

export function Dashboard() {
  const { data: session } = authClient.useSession();
  const { data: repos, isLoading } = useSWR<{ repositories: Repository[] }>("/api/repos?limit=6", fetcher);
  const { data: convos } = useSWR<{ conversations: Convo[] }>("/api/conversations?limit=6", fetcher);
  const { data: status } = useProviderStatus();
  const first = session?.user.name?.split(" ")[0];
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeader title={first ? `Welcome back, ${first}` : "Overview"} description="Your repositories, recent questions, and what this server is configured to do." actions={<ButtonLink href="/repos" variant="primary">Import repository</ButtonLink>} />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-4">
          <Panel>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Repositories</h2>
              <Link href="/repos" className="text-xs text-primary hover:underline">View all</Link>
            </div>
            {isLoading ? (
              <div className="space-y-2 p-4">{[0, 1].map((i) => <Skeleton key={i} className="h-14" />)}</div>
            ) : repos?.repositories.length ? (
              <ul className="divide-y divide-border">
                {repos.repositories.map((r) => (
                  <li key={r.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                    <div className="min-w-0 flex-1 max-sm:basis-full">
                      <Link href={`/repos/${r.id}`} className="block truncate font-mono text-[13.5px] font-medium hover:text-primary">{r.fullName}</Link>
                      <p className="text-xs text-fg-muted">{nf.format(r.fileCount)} files · {nf.format(r.edgeCount)} import edges · {relativeTime(r.lastIndexedAt)}</p>
                    </div>
                    <RepoStatusBadge status={r.status} />
                    {r.status === "ready" ? (
                      <div className="flex gap-1">
                        <ButtonLink size="sm" variant="ghost" href={`/repos/${r.id}/atlas`} aria-label={`Atlas for ${r.fullName}`}><Network /></ButtonLink>
                        <ButtonLink size="sm" variant="ghost" href={`/repos/${r.id}/ask`} aria-label={`Ask about ${r.fullName}`}><MessageSquareText /></ButtonLink>
                        <ButtonLink size="sm" variant="ghost" href={`/repos/${r.id}/stuck`} aria-label={`Stuck Mode for ${r.fullName}`}><LifeBuoy /></ButtonLink>
                      </div>
                    ) : null}
                  </li>
                ))}
              </ul>
            ) : (
              <div className="p-4">
                <EmptyState icon={FolderGit2} title="Import your first repository">Paste a public GitHub repository, or upload a ZIP.</EmptyState>
                <div className="mx-auto max-w-md"><ImportForm /></div>
              </div>
            )}
          </Panel>
          <Panel>
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Recent questions</h2>
              <Link href="/history" className="text-xs text-primary hover:underline">History</Link>
            </div>
            {convos?.conversations.length ? (
              <ul className="divide-y divide-border">
                {convos.conversations.map((c) => (
                  <li key={c.id}>
                    <Link href={c.kind === "chat" ? `/repos/${c.repositoryId}/ask?c=${c.id}` : `/history?c=${c.id}`} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-2">
                      {c.kind === "chat" ? <MessageSquareText className="size-4 text-primary" aria-hidden /> : <LifeBuoy className="size-4 text-info" aria-hidden />}
                      <span className="min-w-0 flex-1 truncate text-[13px]">{c.title}</span>
                      <span className="hidden shrink-0 font-mono text-xs text-fg-subtle sm:block">{c.repositoryName}</span>
                      <span className="shrink-0 text-xs text-fg-subtle">{relativeTime(c.updatedAt)}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-4 py-6 text-center text-[13px] text-fg-muted">Questions you ask will appear here.</p>
            )}
          </Panel>
        </div>
        <Panel className="h-fit p-4">
          <h2 className="text-sm font-semibold">Server capabilities</h2>
          <p className="mt-0.5 text-xs text-fg-muted">What this deployment can actually do right now.</p>
          {status ? (
            <ul className="mt-2 divide-y divide-border">
              <StatusRow ok label="Indexing & Atlas" detail="Tree-sitter parsing for TS, JS, Python, Java, C, C++" />
              <StatusRow ok={status.gemma.configured} label="Gemma answers" detail={status.gemma.configured ? `${status.gemma.model} (${status.gemma.provider})` : `Not configured — set ${status.gemma.missing.join(", ")}`} />
              <StatusRow ok={status.search.configured} label="Web research" detail={status.search.configured ? `${status.search.provider}` : `Not configured — set ${status.search.missing.join(", ")}`} />
              <StatusRow ok={status.embeddings.configured} label="Semantic retrieval" detail={status.embeddings.configured ? "Embeddings enabled (pgvector)" : "Optional — lexical + graph retrieval is used"} />
              <StatusRow ok={status.oauth.github} label="GitHub sign-in" detail={status.oauth.github ? "Enabled" : "Not configured"} />
              <StatusRow ok={status.oauth.google} label="Google sign-in" detail={status.oauth.google ? "Enabled" : "Not configured"} />
            </ul>
          ) : (
            <Skeleton className="mt-3 h-40" />
          )}
        </Panel>
      </div>
    </div>
  );
}
