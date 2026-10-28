"use client";
import { Bookmark, ExternalLink, Globe, MessageSquareText, Trash2 } from "lucide-react";
import Link from "next/link";
import useSWR from "swr";
import { api, fetcher } from "@/lib/client/api";
import { relativeTime } from "@/lib/client/format";
import { Button } from "@/components/ui/button";
import { EmptyState, Panel, SectionHeader, Skeleton } from "@/components/ui/misc";

type SavedAnswer = { id: string; savedAt: string; messageId: string; content: string; model: string | null; conversationId: string; title: string; kind: string; repositoryId: string; repositoryName: string };
type WebRow = { id: string; title: string; url: string; domain: string; snippet: string; publishedAt: string | null; query: string; createdAt: string; repositoryName: string | null };

export function SavedPage() {
  const answers = useSWR<{ saved: SavedAnswer[] }>("/api/saved", fetcher);
  const web = useSWR<{ results: WebRow[] }>("/api/research?saved=1", fetcher);
  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeader title="Saved" description="Answers and web sources you kept for later." />
      <Panel>
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Answers</h2>
        {answers.isLoading ? <div className="p-4"><Skeleton className="h-20" /></div> : answers.data?.saved.length ? (
          <ul className="divide-y divide-border">
            {answers.data.saved.map((a) => (
              <li key={a.id} className="flex gap-3 px-4 py-3">
                <MessageSquareText className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <div className="min-w-0 flex-1">
                  <Link href={`/repos/${a.repositoryId}/ask?c=${a.conversationId}`} className="text-[13.5px] font-medium hover:text-primary">{a.title}</Link>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-muted">{a.content.replace(/[#*`]/g, "").slice(0, 300)}</p>
                  <p className="mt-1 text-[11px] text-fg-subtle"><span className="font-mono">{a.repositoryName}</span> · {a.model ?? "no model"} · saved {relativeTime(a.savedAt)}</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Remove from saved" onClick={async () => { await api("/api/saved", { method: "DELETE", body: JSON.stringify({ messageId: a.messageId }) }); answers.mutate(); }}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={Bookmark} title="No saved answers">Use “Save” under any cited answer.</EmptyState>}
      </Panel>
      <Panel>
        <h2 className="border-b border-border px-4 py-3 text-sm font-semibold">Web sources</h2>
        {web.isLoading ? <div className="p-4"><Skeleton className="h-20" /></div> : web.data?.results.length ? (
          <ul className="divide-y divide-border">
            {web.data.results.map((w) => (
              <li key={w.id} className="flex gap-3 px-4 py-3">
                <Globe className="mt-0.5 size-4 shrink-0 text-info" aria-hidden />
                <div className="min-w-0 flex-1">
                  <a href={w.url} target="_blank" rel="noopener noreferrer nofollow" className="text-[13.5px] font-medium hover:text-info hover:underline">{w.title} <ExternalLink className="inline size-3" aria-hidden /></a>
                  <p className="mt-0.5 line-clamp-2 text-[13px] text-fg-muted">{w.snippet}</p>
                  <p className="mt-1 text-[11px] text-fg-subtle">{w.domain}{w.publishedAt ? ` · ${w.publishedAt}` : ""} · query “{w.query}”</p>
                </div>
                <Button size="icon" variant="ghost" aria-label="Remove from saved" onClick={async () => { await api(`/api/research/${w.id}`, { method: "PATCH", body: JSON.stringify({ saved: false }) }); web.mutate(); }}><Trash2 /></Button>
              </li>
            ))}
          </ul>
        ) : <EmptyState icon={Globe} title="No saved web sources">Save results from Stuck Mode.</EmptyState>}
      </Panel>
    </div>
  );
}
