"use client";
import { ChevronRight } from "lucide-react";
import { memo, type ReactNode } from "react";
import ReactMarkdown from "react-markdown";
import rehypeSanitize from "rehype-sanitize";
import remarkGfm from "remark-gfm";

type MdNode = { type: string; value?: string; url?: string; children?: MdNode[] };
const LINE_REF = /\b([Ll]ines?)\s+(\d{1,4})(?:\s*(?:-|–|to|and)\s*(\d{1,4}))?/g;

/** remark plugin: "line 7" / "lines 3–5" become links that jump the editor to those lines. */
function remarkLineRefs() {
  const walk = (node: MdNode) => {
    if (!node.children) return;
    const out: MdNode[] = [];
    for (const child of node.children) {
      if (child.type === "text" && child.value && LINE_REF.test(child.value)) {
        LINE_REF.lastIndex = 0;
        let last = 0;
        for (const m of child.value.matchAll(LINE_REF)) {
          if (m.index! > last) out.push({ type: "text", value: child.value.slice(last, m.index) });
          out.push({ type: "link", url: `#line:${m[2]}-${m[3] ?? m[2]}`, children: [{ type: "text", value: m[0] }] });
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

const Md = memo(function Md({ text, onLine }: { text: string; onLine: (a: number, b: number) => void }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm, remarkLineRefs]}
      rehypePlugins={[rehypeSanitize]}
      components={{
        a: ({ href, children }) => {
          if (href?.startsWith("#line:")) {
            const [a, b] = href.slice(6).split("-").map(Number);
            return (
              <button type="button" onClick={() => onLine(a, b)} className="cursor-pointer rounded bg-warning/15 px-1 font-mono text-[0.9em] text-warning underline-offset-2 hover:underline" title="Show in the editor">
                {children as ReactNode}
              </button>
            );
          }
          return <span>{children as ReactNode}</span>;
        },
        img: () => null,
      }}
    >
      {text}
    </ReactMarkdown>
  );
});

/** Splits out the "Fixed version" section so students see the hint first. */
export function TutorMarkdown({ text, onLine }: { text: string; onLine: (a: number, b: number) => void }) {
  const m = text.match(/^##\s*Fixed version[^\n]*\n([\s\S]*?)(?=^##\s|$(?![\s\S]))/m);
  if (!m || m.index === undefined) return <div className="prose-answer"><Md text={text} onLine={onLine} /></div>;
  const before = text.slice(0, m.index);
  const after = text.slice(m.index + m[0].length);
  return (
    <div className="prose-answer">
      <Md text={before} onLine={onLine} />
      <details className="group my-3 rounded-lg border border-border bg-surface-2/60 px-3 py-2">
        <summary className="flex cursor-pointer list-none items-center gap-1.5 text-[14px] font-semibold text-fg">
          <ChevronRight className="size-4 transition-transform group-open:rotate-90" aria-hidden /> Fixed version <span className="font-normal text-fg-muted">(try the hint first)</span>
        </summary>
        <div className="mt-2">
          <Md text={m[1]} onLine={onLine} />
        </div>
      </details>
      <Md text={after} onLine={onLine} />
    </div>
  );
}
