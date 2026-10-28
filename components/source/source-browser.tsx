"use client";
import { ChevronDown, ChevronRight, FileCode2, Folder, ScrollText } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { cn } from "@/lib/client/cn";
import { Input } from "@/components/ui/field";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { useRepo } from "@/components/repos/repo-context";
import { SourcePanel } from "./source-viewer";

type F = { id: string; path: string; language: string | null; lines: number; parseStatus: string };
type Tree = { dirs: Map<string, Tree>; files: F[] };

function buildTree(files: F[]): Tree {
  const root: Tree = { dirs: new Map(), files: [] };
  for (const f of files) {
    const parts = f.path.split("/");
    let cur = root;
    for (const p of parts.slice(0, -1)) {
      if (!cur.dirs.has(p)) cur.dirs.set(p, { dirs: new Map(), files: [] });
      cur = cur.dirs.get(p)!;
    }
    cur.files.push(f);
  }
  return root;
}

function TreeView({ tree, prefix, open, toggle, selected, onOpen }: { tree: Tree; prefix: string; open: Set<string>; toggle: (p: string) => void; selected: string | null; onOpen: (f: F) => void }) {
  return (
    <ul role="group">
      {[...tree.dirs.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, sub]) => {
        const path = prefix ? `${prefix}/${name}` : name;
        const isOpen = open.has(path);
        return (
          <li key={path} role="treeitem" aria-expanded={isOpen} aria-selected={false}>
            <button type="button" onClick={() => toggle(path)} className="flex w-full cursor-pointer items-center gap-1 rounded px-1.5 py-1 text-left text-[13px] text-fg-muted hover:bg-surface-2 hover:text-fg">
              {isOpen ? <ChevronDown className="size-3.5" aria-hidden /> : <ChevronRight className="size-3.5" aria-hidden />}
              <Folder className="size-3.5" aria-hidden />
              <span className="truncate">{name}</span>
            </button>
            {isOpen ? <div className="ml-3 border-l border-border pl-1"><TreeView tree={sub} prefix={path} open={open} toggle={toggle} selected={selected} onOpen={onOpen} /></div> : null}
          </li>
        );
      })}
      {tree.files.sort((a, b) => a.path.localeCompare(b.path)).map((f) => (
        <li key={f.id} role="treeitem" aria-selected={selected === f.id}>
          <button type="button" onClick={() => onOpen(f)} className={cn("flex w-full cursor-pointer items-center gap-1.5 rounded px-1.5 py-1 pl-6 text-left text-[13px] hover:bg-surface-2", selected === f.id ? "bg-primary-soft text-fg" : "text-fg-muted")}>
            <FileCode2 className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate font-mono">{f.path.split("/").pop()}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function SourceBrowser() {
  const { repo } = useRepo();
  const params = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const fileId = params.get("file");
  const start = Number(params.get("line") ?? params.get("start") ?? 0) || 0;
  const end = Number(params.get("end") ?? 0) || start;
  const { data, isLoading } = useSWR<{ files: F[] }>(`/api/repos/${repo.id}/files`, fetcher, { revalidateOnFocus: false });
  const [filter, setFilter] = useState("");
  const current = data?.files.find((f) => f.id === fileId);
  const [open, setOpen] = useState<Set<string>>(() => new Set());
  const effectiveOpen = useMemo(() => {
    const s = new Set(open);
    if (current) current.path.split("/").slice(0, -1).forEach((_, i, arr) => s.add(arr.slice(0, i + 1).join("/")));
    return s;
  }, [open, current]);
  const visible = useMemo(() => (data?.files ?? []).filter((f) => !filter || f.path.toLowerCase().includes(filter.toLowerCase())), [data, filter]);
  const tree = useMemo(() => buildTree(visible), [visible]);
  const openFile = (f: F) => router.replace(`${pathname}?file=${f.id}`, { scroll: false });

  return (
    <div className="grid min-h-0 flex-1 lg:grid-cols-[280px_minmax(0,1fr)]">
      <aside className="flex max-h-[40vh] min-h-0 flex-col border-b border-border lg:max-h-none lg:border-b-0 lg:border-r" aria-label="File tree">
        <div className="p-2"><Input value={filter} onChange={(e) => setFilter(e.target.value)} placeholder="Filter files…" aria-label="Filter files" className="h-8 text-[13px]" /></div>
        <div className="min-h-0 flex-1 overflow-auto px-1.5 pb-3" role="tree" aria-label="Repository files">
          {isLoading ? <div className="space-y-1.5 p-2">{Array.from({ length: 10 }, (_, i) => <Skeleton key={i} className="h-5" />)}</div> : <TreeView tree={tree} prefix="" open={filter ? new Set(visible.flatMap((f) => f.path.split("/").slice(0, -1).map((_, i, a) => a.slice(0, i + 1).join("/")))) : effectiveOpen} toggle={(p) => setOpen((s) => { const n = new Set(s); if (n.has(p)) n.delete(p); else n.add(p); return n; })} selected={fileId} onOpen={openFile} />}
        </div>
      </aside>
      <div className="min-h-[60vh] min-w-0">
        {fileId ? (
          <SourcePanel key={fileId} repoId={repo.id} fileId={fileId} range={start ? { start, end: Math.max(end, start) } : undefined} />
        ) : (
          <EmptyState icon={ScrollText} title="Pick a file">Browse the indexed source. Secrets, dependencies and build output were excluded at import.</EmptyState>
        )}
      </div>
    </div>
  );
}
