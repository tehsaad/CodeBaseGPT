"use client";
import { AlertTriangle, NotebookPen, Pencil, Trash2 } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { api, ClientApiError, fetcher } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input, Textarea } from "@/components/ui/field";
import { Badge, EmptyState, Notice, Panel, Skeleton } from "@/components/ui/misc";
import { useRepo } from "@/components/repos/repo-context";
import { useSourceDrawer } from "@/components/source/source-drawer";

const KINDS = [
  ["explanation", "Explanation"],
  ["decision", "Architecture decision"],
  ["debugging", "Debugging finding"],
  ["location", "Important location"],
  ["learning", "Learning note"],
  ["question", "Open question"],
] as const;
type Kind = (typeof KINDS)[number][0];
type Note = { id: string; kind: Kind; title: string; body: string; path: string | null; fileId: string | null; startLine: number | null; endLine: number | null; anchor: "current" | "changed" | "missing" | null; updatedAt: string };

export function NotesView() {
  const { repo } = useRepo();
  const { openSource } = useSourceDrawer();
  const params = useSearchParams();
  const { data, error, mutate } = useSWR<{ notes: Note[] }, ClientApiError>(`/api/repos/${repo.id}/notes`, fetcher);
  const [kind, setKind] = useState<Kind>((params.get("kind") as Kind) || "learning");
  const [title, setTitle] = useState(params.get("title") ?? "");
  const [body, setBody] = useState("");
  const [editing, setEditing] = useState<string | null>(null);
  const [filter, setFilter] = useState<Kind | "">("");
  const [formError, setFormError] = useState<string | null>(null);
  const anchor = params.get("file") ? { fileId: params.get("file")!, startLine: Number(params.get("start")) || undefined, endLine: Number(params.get("end")) || undefined } : null;

  async function save(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    try {
      if (editing) await api(`/api/repos/${repo.id}/notes/${editing}`, { method: "PATCH", body: JSON.stringify({ kind, title, body }) });
      else await api(`/api/repos/${repo.id}/notes`, { method: "POST", body: JSON.stringify({ kind, title, body, ...(anchor ?? {}) }) });
      setTitle("");
      setBody("");
      setEditing(null);
      await mutate();
    } catch (err) {
      setFormError(err instanceof ClientApiError ? err.message : "Couldn't save the note.");
    }
  }
  async function remove(id: string) {
    await api(`/api/repos/${repo.id}/notes/${id}`, { method: "DELETE" });
    await mutate();
  }
  const notes = (data?.notes ?? []).filter((n) => !filter || n.kind === filter);

  return (
    <div className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-6 sm:px-6 lg:grid-cols-[360px_minmax(0,1fr)]">
      <Panel className="h-fit p-4" as="section">
        <h1 className="flex items-center gap-2 text-base font-semibold"><NotebookPen className="size-5 text-primary" aria-hidden /> {editing ? "Edit note" : "New note"}</h1>
        <p className="text-xs text-fg-muted">Your private memory of this repository. Notes anchored to a file are flagged when that file changes on re-import.</p>
        <form onSubmit={save} className="mt-3 space-y-3">
          <Field label="Type">
            {(ids) => <select {...ids} value={kind} onChange={(e) => setKind(e.target.value as Kind)} className="h-9 w-full cursor-pointer rounded-md border border-border-strong bg-surface-2 px-2 text-[13px]">
              {KINDS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
            </select>}
          </Field>
          <Field label="Title">{(ids) => <Input {...ids} value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />}</Field>
          <Field label="Note" hint="Plain text or Markdown.">{(ids) => <Textarea {...ids} value={body} onChange={(e) => setBody(e.target.value)} rows={6} maxLength={20000} />}</Field>
          {anchor && !editing ? <p className="text-xs text-fg-muted">Anchored to the file you came from{anchor.startLine ? ` (line ${anchor.startLine})` : ""}.</p> : null}
          {formError ? <p className="text-xs text-danger" role="alert">{formError}</p> : null}
          <div className="flex gap-2">
            <Button type="submit" variant="primary" disabled={!title.trim()}>{editing ? "Save changes" : "Save note"}</Button>
            {editing ? <Button type="button" variant="ghost" onClick={() => { setEditing(null); setTitle(""); setBody(""); }}>Cancel</Button> : null}
          </div>
        </form>
      </Panel>
      <section className="min-w-0 space-y-3" aria-label="Saved notes">
        <div className="flex flex-wrap items-center gap-1.5">
          <button type="button" onClick={() => setFilter("")} aria-pressed={!filter} className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs aria-pressed:border-primary aria-pressed:text-fg">All ({data?.notes.length ?? 0})</button>
          {KINDS.map(([k, l]) => <button key={k} type="button" onClick={() => setFilter(k)} aria-pressed={filter === k} className="cursor-pointer rounded-full border border-border px-2.5 py-1 text-xs text-fg-muted aria-pressed:border-primary aria-pressed:text-fg">{l}</button>)}
        </div>
        {error ? <Notice tone="danger" title="Couldn't load notes">{error.message}</Notice> : null}
        {!data && !error ? <Skeleton className="h-40" /> : null}
        {data && !notes.length ? <Panel><EmptyState icon={NotebookPen} title="No notes yet">Save explanations, decisions and debugging findings as you learn this codebase.</EmptyState></Panel> : null}
        {notes.map((n) => (
          <Panel key={n.id} className="p-4" as="article">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone="primary">{KINDS.find(([k]) => k === n.kind)?.[1]}</Badge>
              <h2 className="text-[14px] font-semibold">{n.title}</h2>
              <span className="ml-auto flex gap-1">
                <Button size="sm" variant="ghost" aria-label={`Edit ${n.title}`} onClick={() => { setEditing(n.id); setKind(n.kind); setTitle(n.title); setBody(n.body); }}><Pencil /></Button>
                <Button size="sm" variant="ghost" aria-label={`Delete ${n.title}`} onClick={() => void remove(n.id)}><Trash2 /></Button>
              </span>
            </div>
            {n.path ? (
              <p className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                {n.fileId ? <button type="button" className="cursor-pointer font-mono text-fg-muted hover:text-primary" onClick={() => openSource({ fileId: n.fileId!, startLine: n.startLine ?? undefined, endLine: n.endLine ?? undefined, title: n.title })}>{n.path}{n.startLine ? `:${n.startLine}` : ""}</button> : <span className="font-mono text-fg-muted">{n.path}</span>}
                {n.anchor === "changed" ? <span className="inline-flex items-center gap-1 text-warning"><AlertTriangle className="size-3" aria-hidden /> file changed since this note — may be stale</span> : null}
                {n.anchor === "missing" ? <span className="inline-flex items-center gap-1 text-danger"><AlertTriangle className="size-3" aria-hidden /> file no longer in the index</span> : null}
              </p>
            ) : null}
            {n.body ? <p className="mt-2 whitespace-pre-wrap text-[13.5px] text-fg-muted">{n.body}</p> : null}
            <p className="mt-2 text-[11px] text-fg-subtle">Updated {new Date(n.updatedAt).toLocaleString()}</p>
          </Panel>
        ))}
      </section>
    </div>
  );
}
