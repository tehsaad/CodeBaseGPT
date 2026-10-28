"use client";
import { ExternalLink } from "lucide-react";
import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";
import type { EvidenceItem, WebItem } from "@/lib/ai/types";
import { cn } from "@/lib/client/cn";
import { safeExternalUrl } from "@/lib/search/url";

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };
const CITE = /\[((?:[CW]\d{1,3})(?:\s*[,;]\s*[CW]\d{1,3})*)\]/g;

/** remark plugin: turns "[C1, W2]" in text into links with a `#cite:` URL (rendered as chips). */
function remarkCitations() {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    const out: MdNode[] = [];
    for (const child of node.children) {
      if (child.type === "text" && child.value && CITE.test(child.value)) {
        CITE.lastIndex = 0;
        let last = 0;
        for (const m of child.value.matchAll(CITE)) {
          if (m.index! > last) out.push({ type: "text", value: child.value.slice(last, m.index) });
          out.push({ type: "link", url: `#cite:${m[1].replace(/\s+/g, "")}`, children: [{ type: "text", value: m[1] }] });
          last = m.index! + m[0].length;
        }
        if (last < child.value.length) out.push({ type: "text", value: child.value.slice(last) });
      } else {
        if (child.type !== "code" && child.type !== "inlineCode" && child.type !== "link") walk(child);
        out.push(child);
      }
    }
    node.children = out;
  };
  return (tree: MdNode) => walk(tree);
}

export type CiteHandlers = {
  evidence: Map<string, EvidenceItem>;
  web: Map<string, WebItem>;
  onOpenEvidence: (e: EvidenceItem) => void;
};

function CiteChips({ labels, h }: { labels: string[]; h: CiteHandlers }) {
  return (
    <span className="mx-0.5 inline-flex flex-wrap gap-0.5 align-baseline">
      {labels.map((label) => {
        const ev = h.evidence.get(label);
        const web = h.web.get(label);
        if (ev) {
          return (
            <button key={label} type="button" onClick={() => h.onOpenEvidence(ev)} title={`${ev.path}:${ev.startLine}–${ev.endLine}`} aria-label={`Open citation ${label}: ${ev.path} lines ${ev.startLine} to ${ev.endLine}`} className="inline-flex cursor-pointer items-center rounded border border-primary/40 bg-primary-soft px-1 font-mono text-[11px] font-medium leading-[18px] text-primary hover:bg-primary-fill hover:text-on-primary">
              {label}
            </button>
          );
        }
        if (web) {
          return (
            <a key={label} href={web.url} target="_blank" rel="noopener noreferrer nofollow" title={`${web.title} — ${web.domain}`} aria-label={`Open web source ${label}: ${web.title} on ${web.domain} (new tab)`} className="inline-flex items-center rounded border border-info/40 bg-info-soft px-1 font-mono text-[11px] font-medium leading-[18px] text-info !no-underline hover:bg-info hover:text-bg">
              {label}
            </a>
          );
        }
        return (
          <span key={label} title="This label wasn't in the supplied evidence, so it isn't linked" className="inline-flex items-center rounded border border-danger/40 bg-danger-soft px-1 font-mono text-[11px] leading-[18px] text-danger line-through">
            {label}
          </span>
        );
      })}
    </span>
  );
}

export const AnswerMarkdown = memo(function AnswerMarkdown({ text, h, className }: { text: string; h: CiteHandlers; className?: string }) {
  return (
    <div className={cn("prose-answer", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm, remarkCitations]}
        rehypePlugins={[rehypeSanitize]}
        components={{
          a: ({ href, children }) => {
            if (href?.startsWith("#cite:")) return <CiteChips labels={href.slice(6).split(/[,;]/)} h={h} />;
            const url = safeExternalUrl(href);
            if (!url) return <span>{children as ReactNode}</span>;
            return (
              <a href={url.toString()} target="_blank" rel="noopener noreferrer nofollow">
                {children as ReactNode}
                <ExternalLink className="ml-0.5 inline size-3 align-baseline" aria-hidden />
              </a>
            );
          },
          img: () => null,
        }}
      >
        {text}
      </ReactMarkdown>
    </div>
  );
});
