"use client";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { AlertTriangle, ArrowUp, Bookmark, BookmarkCheck, Copy, FileCode2, LifeBuoy, MessageSquareText, Plus, Sparkles, Square, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import useSWR from "swr";
import type { CbgUIMessage, EvidenceItem } from "@/lib/ai/types";
import { api, fetcher } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { relativeTime } from "@/lib/client/format";
import { Button, ButtonLink } from "@/components/ui/button";
import { Textarea } from "@/components/ui/field";
import { Badge, Notice, Skeleton } from "@/components/ui/misc";
import { useRepo } from "@/components/repos/repo-context";
import { useSourceDrawer } from "@/components/source/source-drawer";
import { useFileDetail } from "@/components/source/source-viewer";
import { AnswerMarkdown } from "./answer-markdown";
import { EvidenceList } from "./evidence";
import { fromStored, partsOf } from "./message-parts";
import { useProviderStatus } from "./use-status";
import { ThinkingIndicator } from "./thinking";

type Focus = { fileId?: string; symbolId?: string; startLine?: number; endLine?: number };

const STARTERS = [
  "How does authentication work in this project?",
  "Trace what happens when a request comes in, from entry point to response.",
  "Which modules are the core of this codebase, and why?",
  "Where should I start reading to understand this project?",
];
const FOCUS_STARTERS = ["Explain this module to a beginner.", "Where is this called from?", "What could break if I change this?", "What should I learn before changing this?"];

function FocusChip({ repoId, focus, onClear }: { repoId: string; focus: Focus; onClear: () => void }) {
  const { data } = useFileDetail(repoId, focus.fileId ?? null);
  const symbol = data?.symbols.find((s) => s.id === focus.symbolId);
  const label = data ? `${data.file.path}${symbol ? ` · ${symbol.name}` : focus.startLine ? `:${focus.startLine}–${focus.endLine}` : ""}` : "Loading focus…";
  return (
    <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary-soft px-2.5 py-1.5 text-[12.5px]">
      <FileCode2 className="size-3.5 text-primary" aria-hidden />
      <span className="text-fg-muted">Focused on</span>
      <span className="min-w-0 truncate font-mono">{label}</span>
      <button type="button" onClick={onClear} className="ml-auto grid size-6 shrink-0 cursor-pointer place-items-center rounded hover:bg-surface-3" aria-label="Remove focus">
        <X className="size-3.5" />
      </button>
    </div>
  );
}

function AssistantMessage({ m, onOpen, onSave, saved }: { m: CbgUIMessage; onOpen: (e: EvidenceItem) => void; onSave: (id: string) => void; saved: boolean }) {
  const p = partsOf(m);
  const used = useMemo(() => new Set(p.citations?.used ?? []), [p.citations]);
  const handlers = useMemo(() => ({ evidence: new Map(p.evidence.map((e) => [e.label, e])), web: new Map((p.web?.items ?? []).map((w) => [w.label, w])), onOpenEvidence: onOpen }), [p.evidence, p.web, onOpen]);
  const [showEvidence, setShowEvidence] = useState(false);
  const streaming = !p.citations && !p.status;
  return (
    <article className="space-y-2" aria-label="Answer">
      <div className="flex flex-wrap items-center gap-2 text-xs text-fg-subtle">
        <Sparkles className="size-3.5 text-accent" aria-hidden />
        <span>{p.meta?.model ? `AI answer · ${p.meta.model}` : p.status?.code === "insufficient_evidence" ? "No answer generated" : p.status ? "No AI answer" : "Retrieving evidence…"}</span>
        {p.evidence.length ? (
          <button type="button" onClick={() => setShowEvidence((s) => !s)} className="cursor-pointer text-primary hover:underline" aria-expanded={showEvidence}>
            {showEvidence ? "Hide" : "Show"} {p.evidence.length} evidence snippet{p.evidence.length === 1 ? "" : "s"}
          </button>
        ) : null}
      </div>
      {p.status?.kind === "error" && p.status.code !== "provider_not_configured" ? (
        <Notice tone="danger" title={p.status.message}>No answer was generated, so nothing below is AI output. You can retry or open the retrieved code.</Notice>
      ) : null}
      {streaming && (!p.text || p.progress?.phase !== "writing") ? <ThinkingIndicator progress={p.progress} /> : null}
      {p.text ? <AnswerMarkdown text={p.text} h={handlers} /> : null}
      {p.citations?.invalid.length ? (
        <p className="flex items-center gap-1.5 text-xs text-warning">
          <AlertTriangle className="size-3.5" aria-hidden /> The model referenced {p.citations.invalid.join(", ")}, which weren&apos;t in the evidence, so they aren&apos;t linked. Treat those statements as unverified.
        </p>
      ) : null}
      {p.citations && p.text && p.citations.used.length === 0 && p.evidence.length > 0 ? (
        <p className="flex items-center gap-1.5 text-xs text-warning"><AlertTriangle className="size-3.5" aria-hidden /> This answer cites no evidence. Treat it as general guidance, not a fact about this repository.</p>
      ) : null}
      {showEvidence ? (
        <div className="rounded-lg border border-border bg-surface p-3">
          <p className="mb-2 text-xs text-fg-muted">Exactly what the model was given. Click to open the source.</p>
          <EvidenceList items={p.evidence} used={p.citations ? used : undefined} onOpen={onOpen} />
        </div>
      ) : null}
      {p.citations || p.status ? (
        <div className="flex flex-wrap gap-1">
          {p.meta?.messageId && p.status?.code !== "insufficient_evidence" && !p.status ? (
            <Button size="sm" variant="ghost" onClick={() => onSave(p.meta!.messageId)} aria-pressed={saved}>
              {saved ? <BookmarkCheck /> : <Bookmark />} {saved ? "Saved" : "Save"}
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => navigator.clipboard?.writeText(p.text)}><Copy /> Copy</Button>
        </div>
      ) : null}
    </article>
  );
}

export function ChatView({ onConversationAssigned }: { onConversationAssigned?: (id: string) => void }) {
  const { repo } = useRepo();
  const { openSource } = useSourceDrawer();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const { data: status } = useProviderStatus();
  // Captured once: the chat writes ?c= itself mid-stream, which must not reset useChat.
  const [initialConvo] = useState(() => params.get("c"));
  const [conversationId, setConversationId] = useState<string | null>(initialConvo);
  const [focus, setFocus] = useState<Focus | null>(() => {
    const fileId = params.get("file") ?? undefined;
    const symbolId = params.get("symbol") ?? undefined;
    const start = Number(params.get("start")) || undefined;
    const end = Number(params.get("end")) || start;
    return fileId || symbolId ? { fileId, symbolId, startLine: start, endLine: end } : null;
  });
  const [input, setInput] = useState(params.get("q") ?? "");
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const bottomRef = useRef<HTMLDivElement>(null);

  const { messages, sendMessage, status: chatStatus, stop, setMessages, error } = useChat<CbgUIMessage>({
    id: `chat-${repo.id}-${initialConvo ?? "new"}`,
    transport: new DefaultChatTransport({
      api: `/api/repos/${repo.id}/chat`,
      prepareSendMessagesRequest: ({ messages, body }) => {
        const last = messages[messages.length - 1];
        const text = last.parts.map((p) => (p.type === "text" ? p.text : "")).join("");
        return { body: { ...body, message: text } };
      },
    }),
    onData: (part) => {
      if (part.type === "data-meta" && !conversationId) {
        setConversationId(part.data.conversationId);
        onConversationAssigned?.(part.data.conversationId);
        const next = new URLSearchParams(params.toString());
        next.set("c", part.data.conversationId);
        router.replace(`${pathname}?${next.toString()}`, { scroll: false });
      }
    },
  });

  const { data: stored, isLoading: loadingStored } = useSWR<{ conversation: { id: string; kind: "chat" | "stuck" }; messages: Parameters<typeof fromStored>[2] }>(initialConvo ? `/api/conversations/${initialConvo}` : null, fetcher, { revalidateOnFocus: false });
  useEffect(() => {
    if (stored && messages.length === 0) setMessages(fromStored(stored.conversation.id, "chat", stored.messages));
  }, [stored]); // eslint-disable-line react-hooks/exhaustive-deps

  const { data: history, mutate: refreshHistory } = useSWR<{ conversations: { id: string; title: string; updatedAt: string; messages: number }[] }>(`/api/conversations?repositoryId=${repo.id}&kind=chat&limit=30`, fetcher);
  useEffect(() => {
    if (chatStatus === "ready") refreshHistory();
  }, [chatStatus, refreshHistory]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: "end", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [messages]);

  const busy = chatStatus === "submitted" || chatStatus === "streaming";
  const submit = (text: string) => {
    const t = text.trim();
    if (!t || busy) return;
    sendMessage({ text: t }, { body: { conversationId: conversationId ?? undefined, focus: focus ?? undefined } });
    setInput("");
  };
  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    submit(input);
  };
  const onOpen = (e: EvidenceItem) => openSource({ fileId: e.fileId, startLine: e.startLine, endLine: e.endLine, title: `${e.label} · ${e.path}` });
  const onSave = async (messageId: string) => {
    const isSaved = savedIds.has(messageId);
    await api("/api/saved", { method: isSaved ? "DELETE" : "POST", body: JSON.stringify({ messageId }) });
    setSavedIds((s) => {
      const n = new Set(s);
      if (isSaved) n.delete(messageId);
      else n.add(messageId);
      return n;
    });
  };
  const newChat = () => router.replace(pathname, { scroll: false });
  const lastUser = [...messages].reverse().find((m) => m.role === "user");
  const lastUserText = lastUser?.parts.map((p) => (p.type === "text" ? p.text : "")).join("") ?? "";

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[240px_minmax(0,1fr)]">
      <aside className="hidden min-h-0 flex-col border-r border-border lg:flex" aria-label="Conversations">
        <div className="p-3"><Button size="sm" className="w-full" onClick={newChat}><Plus /> New conversation</Button></div>
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-auto px-2 pb-3">
          {(history?.conversations ?? []).map((c) => (
            <li key={c.id}>
              <Link href={`${pathname}?c=${c.id}`} className={cn("block rounded-md px-2.5 py-2 text-[13px] hover:bg-surface-2", c.id === conversationId ? "bg-primary-soft text-fg" : "text-fg-muted")}>
                <span className="line-clamp-2">{c.title}</span>
                <span className="text-[11px] text-fg-subtle">{relativeTime(c.updatedAt)}</span>
              </Link>
            </li>
          ))}
          {history && !history.conversations.length ? <li className="px-2.5 text-xs text-fg-subtle">No conversations yet.</li> : null}
        </ul>
      </aside>

      <section className="flex min-h-0 flex-col" aria-label="Ask CodeBaseGPT">
        <div className="min-h-0 flex-1 overflow-auto">
          <div className="mx-auto w-full max-w-3xl space-y-6 px-4 py-6 sm:px-6">
            {status && !status.gemma.configured ? (
              <Notice tone="warning" title="Gemma isn't configured on this server">
                You&apos;ll still see the code retrieval finds for each question, but no AI answer is generated. Set <span className="font-mono">{status.gemma.missing.join(", ")}</span> (see <span className="font-mono">docs/gemma.md</span>).
              </Notice>
            ) : null}
            {loadingStored ? <Skeleton className="h-24" /> : null}
            {messages.length === 0 && !loadingStored ? (
              <div className="py-6">
                <MessageSquareText className="size-6 text-primary" aria-hidden />
                <h2 className="mt-3 text-lg font-semibold">Ask about {repo.fullName}</h2>
                <p className="mt-1 max-w-xl text-sm text-fg-muted">
                  Answers are grounded in code retrieved from this repository. Every claim about the code links to the file and lines it came from. Anything the model infers is labelled <span className="font-medium text-fg">Inference</span>.
                </p>
                <div className="mt-5 grid gap-2 sm:grid-cols-2">
                  {(focus ? FOCUS_STARTERS : STARTERS).map((q) => (
                    <button key={q} type="button" onClick={() => submit(q)} className="cursor-pointer rounded-lg border border-border bg-surface px-3 py-2.5 text-left text-[13px] text-fg-muted hover:border-border-strong hover:text-fg">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}
            {messages.map((m) =>
              m.role === "user" ? (
                <div key={m.id} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-xl rounded-br-sm bg-surface-3 px-3.5 py-2 text-[14.5px]">{m.parts.map((p) => (p.type === "text" ? p.text : "")).join("")}</p>
                </div>
              ) : (
                <AssistantMessage key={m.id} m={m} onOpen={onOpen} onSave={onSave} saved={savedIds.has(partsOf(m).meta?.messageId ?? "")} />
              ),
            )}
            {error ? (
              <Notice tone="danger" title="The request failed" action={<Button size="sm" onClick={() => submit(lastUserText)}>Retry</Button>}>
                {error.message.includes("{") ? "The server rejected the request." : error.message}
              </Notice>
            ) : null}
            {messages.length > 1 && !busy ? (
              <div className="rounded-lg border border-border bg-surface px-3 py-2.5 text-[13px] text-fg-muted">
                Still stuck? <ButtonLink size="sm" variant="link" href={`/repos/${repo.id}/stuck?q=${encodeURIComponent(lastUserText)}`}><LifeBuoy /> Research this on the web</ButtonLink>
              </div>
            ) : null}
            <div ref={bottomRef} />
          </div>
        </div>
        <form onSubmit={onSubmit} className="border-t border-border bg-surface/80 p-3 backdrop-blur sm:px-6">
          <div className="mx-auto w-full max-w-3xl space-y-2">
            {focus ? <FocusChip repoId={repo.id} focus={focus} onClear={() => setFocus(null)} /> : null}
            <div className="flex items-end gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    submit(input);
                  }
                }}
                rows={2}
                maxLength={4000}
                placeholder="Ask how something works, where it's called, or what could break…"
                aria-label="Your question"
                className="max-h-48 min-h-11 resize-y"
              />
              {busy ? (
                <Button type="button" size="icon" onClick={() => stop()} aria-label="Stop generating"><Square /></Button>
              ) : (
                <Button type="submit" variant="primary" size="icon" disabled={!input.trim()} aria-label="Send question"><ArrowUp /></Button>
              )}
            </div>
            <p className="flex flex-wrap items-center gap-2 text-[11px] text-fg-subtle">
              <span>Enter to send · Shift+Enter for a new line</span>
              {conversationId ? <Badge>saved to history</Badge> : null}
              <button type="button" onClick={newChat} className="cursor-pointer text-primary hover:underline lg:hidden">New conversation</button>
            </p>
          </div>
        </form>
      </section>
    </div>
  );
}
