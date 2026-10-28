"use client";
import { ExternalLink, History, LifeBuoy, MessageSquareText, Trash2 } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client/api";
import { relativeTime } from "@/lib/client/format";
import { cn } from "@/lib/client/cn";
import { Button } from "@/components/ui/button";
import { Badge, EmptyState, Panel, SectionHeader, Skeleton } from "@/components/ui/misc";
import { AnswerMarkdown } from "@/components/chat/answer-markdown";

type Convo = { id: string; title: string; kind: "chat" | "stuck"; repositoryId: string; repositoryName: string; updatedAt: string; messages: number };
type Msg = { id: string; role: "user" | "assistant"; content: string; status: string; model: string | null; createdAt: string; citations: { kind: string; label: string; path: string | null; startLine: number | null; endLine: number | null; url: string | null; title: string | null; domain: string | null; cited: boolean; fileId: string | null }[] };
type WebRow = { id: string; title: string; url: string; domain: string; query: string; createdAt: string; repositoryName: string | null };

function ConversationDetail({ id }: { id: string }) {
  const router = useRouter();
  const { data } = useSWR<{ conversation: Convo; messages: Msg[] }>(`/api/conversations/${id}`, fetcher);
  if (!data) return <Skeleton className="h-40" />;
  const repoId = data.conversation.repositoryId;
  return (
    <div className="space-y-4">
      {data.messages.map((m) =>
        m.role === "user" ? (
          <p key={m.id} className="rounded-lg bg-surface-3 px-3 py-2 text-[14px]">{m.content}</p>
        ) : (
          <div key={m.id} className="space-y-2">
            <p className="text-xs text-fg-subtle">{m.model ?? "No AI answer"} · {m.status}</p>
            <AnswerMarkdown
              text={m.content}
              h={{
                evidence: new Map(m.citations.filter((c) => c.kind === "repo" && c.fileId).map((c) => [c.label, { label: c.label, fileId: c.fileId!, path: c.path!, startLine: c.startLine!, endLine: c.endLine!, symbol: null, reason: "", language: null, preview: "" }])),
                web: new Map(m.citations.filter((c) => c.kind === "web" && c.url).map((c) => [c.label, { label: c.label, title: c.title ?? "", url: c.url!, domain: c.domain ?? "", snippet: "", publishedAt: null }])),
                onOpenEvidence: (e) => router.push(`/repos/${repoId}/source?file=${e.fileId}&line=${e.startLine}&end=${e.endLine}`),
              }}
            />
          </div>
        ),
      )}
    </div>
  );
}

export function HistoryPage() {
  const params = useSearchParams();
  const router = useRouter();
  const selected = params.get("c");
  const convos = useSWR<{ conversations: Convo[] }>("/api/conversations?limit=100", fetcher);
  const web = useSWR<{ results: WebRow[] }>("/api/research?limit=30", fetcher);
  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeader title="History" description="Every conversation and web search, scoped to your account." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <Panel className="h-fit">
          <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Conversations</h2>
          {convos.isLoading ? <div className="p-4"><Skeleton className="h-32" /></div> : convos.data?.conversations.length ? (
            <ul className="divide-y divide-border">
              {convos.data.conversations.map((c) => (
                <li key={c.id} className={cn("flex items-center gap-2 px-3 py-2", selected === c.id && "bg-primary-soft")}>
                  {c.kind === "chat" ? <MessageSquareText className="size-4 shrink-0 text-primary" aria-hidden /> : <LifeBuoy className="size-4 shrink-0 text-info" aria-hidden />}
                  <button type="button" onClick={() => router.replace(`/history?c=${c.id}`, { scroll: false })} className="min-w-0 flex-1 cursor-pointer text-left">
                    <span className="block truncate text-[13px]">{c.title}</span>
                    <span className="block truncate text-[11px] text-fg-subtle"><span className="font-mono">{c.repositoryName}</span> · {c.messages} messages · {relativeTime(c.updatedAt)}</span>
                  </button>
                  <Button size="icon" variant="ghost" aria-label={`Delete conversation ${c.title}`} onClick={async () => { if (!confirm("Delete this conversation?")) return; await api(`/api/conversations/${c.id}`, { method: "DELETE" }); if (selected === c.id) router.replace("/history"); convos.mutate(); }}><Trash2 /></Button>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={History} title="No conversations yet" />}
        </Panel>
        <div className="space-y-4">
          <Panel className="p-4">
            {selected ? (
              <>
                {(() => {
                  const c = convos.data?.conversations.find((x) => x.id === selected);
                  return c ? (
                    <div className="mb-4 flex flex-wrap items-center gap-2">
                      <Badge tone={c.kind === "chat" ? "primary" : "info"}>{c.kind === "chat" ? "Ask" : "Stuck Mode"}</Badge>
                      <span className="font-mono text-xs text-fg-muted">{c.repositoryName}</span>
                      {c.kind === "chat" ? <Link className="ml-auto text-xs text-primary hover:underline" href={`/repos/${c.repositoryId}/ask?c=${c.id}`}>Continue in Ask</Link> : null}
                    </div>
                  ) : null;
                })()}
                <ConversationDetail id={selected} />
              </>
            ) : (
              <p className="py-10 text-center text-[13px] text-fg-muted">Select a conversation to read it.</p>
            )}
          </Panel>
          <Panel>
            <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Recent web searches</h2>
            {web.data?.results.length ? (
              <ul className="divide-y divide-border">
                {web.data.results.map((w) => (
                  <li key={w.id} className="px-4 py-2.5">
                    <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[13px] hover:text-info hover:underline">{w.title} <ExternalLink className="inline size-3" aria-hidden /></a>
                    <p className="text-[11px] text-fg-subtle">{w.domain} · “{w.query}” · {relativeTime(w.createdAt)}</p>
                  </li>
                ))}
              </ul>
            ) : <p className="px-4 py-6 text-center text-[13px] text-fg-muted">No web searches yet.</p>}
          </Panel>
        </div>
      </div>
    </div>
  );
}
