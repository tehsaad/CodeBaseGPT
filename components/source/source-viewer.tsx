"use client";
import { ArrowUpRight, Braces, ExternalLink, FileCode2, MessageSquareText, Network } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import useSWR from "swr";
import { fetcher, type ClientApiError } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { highlight, shikiLang } from "@/lib/client/highlight";
import { languageLabel } from "@/lib/code-intelligence/languages";
import { ButtonLink } from "@/components/ui/button";
import { Badge, Notice, Skeleton } from "@/components/ui/misc";

export type FileDetail = {
  file: { id: string; path: string; language: string | null; lines: number; sizeBytes: number; parseStatus: string; parseError: string | null; content: string };
  symbols: { id: string; name: string; kind: string; parentName: string | null; startLine: number; endLine: number; complexity: number; exported: boolean }[];
  imports: { specifier: string; line: number; kind: string; names: string[]; targetFileId: string | null; targetPath: string | null }[];
  dependents: { fileId: string; line: number; path: string }[];
  repository: { id: string; fullName: string; htmlUrl: string | null; commitSha: string | null };
};

export function useFileDetail(repoId: string, fileId: string | null) {
  return useSWR<FileDetail, ClientApiError>(fileId ? `/api/repos/${repoId}/files/${fileId}` : null, fetcher, { revalidateOnFocus: false });
}

function escapeHtml(s: string) {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function plainHtml(code: string, range?: { start: number; end: number }) {
  const lines = code.split("\n").map((l, i) => {
    const n = i + 1;
    const hl = range && n >= range.start && n <= range.end ? " is-highlighted" : "";
    return `<span class="line${hl}" data-line="${n}">${escapeHtml(l)}</span>`;
  });
  return `<pre class="shiki"><code>${lines.join("")}</code></pre>`;
}

/** Highlighted code with line numbers; scrolls the highlighted range into view. */
export function CodeView({ path, language, content, range, className }: { path: string; language: string | null; content: string; range?: { start: number; end: number }; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const lang = shikiLang(path, language);
  const key = `${path}|${lang}|${range?.start}|${range?.end}|${content.length}`;
  const plain = useMemo(() => plainHtml(content, range), [content, range?.start, range?.end]); // eslint-disable-line react-hooks/exhaustive-deps
  const [highlighted, setHighlighted] = useState<{ key: string; html: string } | null>(null);
  const html = highlighted?.key === key ? highlighted.html : plain;
  useEffect(() => {
    let alive = true;
    if (lang) highlight(content, lang, range).then((h) => alive && setHighlighted({ key, html: h })).catch(() => {});
    return () => {
      alive = false;
    };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!range) return;
    const el = ref.current?.querySelector(`[data-line="${range.start}"]`);
    el?.scrollIntoView({ block: "center", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, [html, range?.start]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div
      ref={ref}
      tabIndex={0}
      role="region"
      aria-label={`Source of ${path}${range ? `, lines ${range.start} to ${range.end} highlighted` : ""}`}
      className={cn("code-view overflow-auto bg-code py-2 font-mono text-[12.5px] leading-[1.5]", className)}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

export function githubBlobUrl(d: FileDetail, range?: { start: number; end: number }) {
  if (!d.repository.htmlUrl || !d.repository.commitSha) return null;
  const anchor = range ? `#L${range.start}${range.end !== range.start ? `-L${range.end}` : ""}` : "";
  return `${d.repository.htmlUrl}/blob/${d.repository.commitSha}/${d.file.path.split("/").map(encodeURIComponent).join("/")}${anchor}`;
}

/** Full source panel: header actions, code, and the file's symbols / imports / dependents. */
export function SourcePanel({ repoId, fileId, range, compact = false, onSelectRange }: { repoId: string; fileId: string; range?: { start: number; end: number }; compact?: boolean; onSelectRange?: (r: { start: number; end: number }) => void }) {
  const { data, error, isLoading } = useFileDetail(repoId, fileId);
  const rangeKey = `${fileId}:${range?.start}-${range?.end}`;
  const [picked, setPicked] = useState<{ for: string; r: { start: number; end: number } } | null>(null);
  const local = picked?.for === rangeKey ? picked.r : range;
  const select = (r: { start: number; end: number }) => {
    setPicked({ for: rangeKey, r });
    onSelectRange?.(r);
  };
  const gh = useMemo(() => (data ? githubBlobUrl(data, local) : null), [data, local]);

  if (error) return <div className="p-4"><Notice tone="danger" title="Couldn't open this file">{error.message}</Notice></div>;
  if (isLoading || !data) return <div className="space-y-2 p-4">{Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-4" />)}</div>;
  const { file, symbols, imports, dependents } = data;
  const nodeParam = encodeURIComponent(`file:${file.path}`);
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex flex-wrap items-center gap-2 border-b border-border px-4 py-2.5">
        <FileCode2 className="size-4 text-primary" aria-hidden />
        <span className="min-w-0 flex-1 truncate font-mono text-[13px]" title={file.path}>
          {file.path}
          {local ? <span className="text-fg-muted">:{local.start}{local.end !== local.start ? `–${local.end}` : ""}</span> : null}
        </span>
        <Badge>{languageLabel(file.language)}</Badge>
        <span className="text-xs text-fg-subtle">{file.lines} lines</span>
      </div>
      <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-2">
        <ButtonLink size="sm" variant="ghost" href={`/repos/${repoId}/atlas?node=${nodeParam}`}><Network /> Show in Atlas</ButtonLink>
        <ButtonLink size="sm" variant="ghost" href={`/repos/${repoId}/ask?file=${file.id}${local ? `&start=${local.start}&end=${local.end}` : ""}`}><MessageSquareText /> Ask about {local ? "these lines" : "this file"}</ButtonLink>
        {!compact ? <ButtonLink size="sm" variant="ghost" href={`/repos/${repoId}/source?file=${file.id}`}><ArrowUpRight /> Open full view</ButtonLink> : null}
        {gh ? <a className="inline-flex h-8 items-center gap-1.5 rounded-md px-3 text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg" href={gh} target="_blank" rel="noopener noreferrer"><ExternalLink className="size-4" aria-hidden /> GitHub</a> : null}
      </div>
      {file.parseStatus === "error" ? <Notice tone="warning" className="m-3" title="This file couldn't be parsed for symbols">It&apos;s still searchable as text.</Notice> : null}
      <div className={cn("grid min-h-0 flex-1", compact ? "grid-rows-[minmax(0,1fr)_auto]" : "lg:grid-cols-[minmax(0,1fr)_260px]")}>
        <CodeView path={file.path} language={file.language} content={file.content} range={local} className="min-h-0" />
        <aside className={cn("min-h-0 overflow-auto border-border text-[13px]", compact ? "max-h-56 border-t" : "border-t lg:border-l lg:border-t-0")} aria-label="File outline">
          {symbols.length ? (
            <div className="p-3">
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Symbols ({symbols.length})</h3>
              <ul className="space-y-0.5">
                {symbols.map((s) => (
                  <li key={s.id}>
                    <button type="button" onClick={() => select({ start: s.startLine, end: s.endLine })} className={cn("flex w-full cursor-pointer items-center gap-2 rounded px-1.5 py-1 text-left hover:bg-surface-2", local?.start === s.startLine && "bg-primary-soft")}>
                      <Braces className="size-3.5 shrink-0 text-info" aria-hidden />
                      <span className="truncate font-mono">{s.parentName ? `${s.parentName.split("::").pop()}.` : ""}{s.name}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-fg-subtle">{s.startLine}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {imports.length ? (
            <div className="border-t border-border p-3">
              <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Imports ({imports.length})</h3>
              <ul className="space-y-0.5">
                {imports.map((i, idx) => (
                  <li key={`${i.line}-${idx}`} className="flex items-center gap-2 px-1.5 py-0.5">
                    {i.targetFileId ? (
                      <Link className="truncate font-mono text-primary hover:underline" href={`/repos/${repoId}/source?file=${i.targetFileId}`}>{i.targetPath}</Link>
                    ) : (
                      <span className="truncate font-mono text-fg-muted">{i.specifier}</span>
                    )}
                    <span className="ml-auto shrink-0 text-[11px] text-fg-subtle">{i.kind === "internal" ? `L${i.line}` : i.kind}</span>
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          <div className="border-t border-border p-3">
            <h3 className="mb-1.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">Imported by ({dependents.length})</h3>
            {dependents.length ? (
              <ul className="space-y-0.5">
                {dependents.map((d) => (
                  <li key={`${d.fileId}-${d.line}`}>
                    <Link className="flex items-center gap-2 rounded px-1.5 py-0.5 hover:bg-surface-2" href={`/repos/${repoId}/source?file=${d.fileId}&line=${d.line}`}>
                      <span className="truncate font-mono">{d.path}</span>
                      <span className="ml-auto shrink-0 font-mono text-[11px] text-fg-subtle">L{d.line}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-1.5 text-fg-muted">No indexed file imports this one.</p>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
