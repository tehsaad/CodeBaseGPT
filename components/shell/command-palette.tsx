"use client";
import { Command } from "cmdk";
import * as Dialog from "@radix-ui/react-dialog";
import { Braces, FileCode2, FolderTree, GitFork, ListTree, Network, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api } from "@/lib/client/api";
import { useNav } from "./nav";

type Hit = { type: "symbol" | "file"; id: string; fileId: string; name: string; path: string; kind: string | null; startLine: number | null };

/** ⌘K / Ctrl+K: jump to any page, or to a file/symbol in the current repository. */
export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<Hit[]>([]);
  const router = useRouter();
  const { groups, repoId } = useNav();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    const onOpen = () => setOpen(true);
    window.addEventListener("keydown", onKey);
    window.addEventListener("cbg-open-palette", onOpen);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("cbg-open-palette", onOpen);
    };
  }, []);

  const searchable = Boolean(repoId) && query.trim().length >= 2;
  useEffect(() => {
    if (!searchable) return;
    const t = setTimeout(() => {
      api<{ results: Hit[] }>(`/api/repos/${repoId}/search?q=${encodeURIComponent(query.trim())}`)
        .then((r) => setHits(r.results))
        .catch(() => setHits([]));
    }, 150);
    return () => clearTimeout(t);
  }, [query, repoId, searchable]);

  const go = (href: string) => {
    setOpen(false);
    setQuery("");
    router.push(href);
  };

  // Atlas views and impact for the current repository, plus the matching search hits.
  const actions = repoId
    ? [
        { label: "Atlas: architecture view", href: `/repos/${repoId}/atlas?mode=architecture`, icon: FolderTree },
        { label: "Atlas: file dependencies", href: `/repos/${repoId}/atlas?mode=dependencies`, icon: Network },
        { label: "Atlas: symbols & calls", href: `/repos/${repoId}/atlas?mode=symbols`, icon: ListTree },
        { label: "Change impact explorer", href: `/repos/${repoId}/impact`, icon: GitFork },
      ].filter((a) => !query || a.label.toLowerCase().includes(query.toLowerCase()))
    : [];
  const item = "flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-fg-muted data-[selected=true]:bg-surface-2 data-[selected=true]:text-fg";
  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <Dialog.Content className="fixed left-1/2 top-[12vh] z-50 w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border border-border bg-surface shadow-overlay">
          <Dialog.Title className="sr-only">Command palette</Dialog.Title>
          <Dialog.Description className="sr-only">Search pages, files, and symbols</Dialog.Description>
          <Command label="Command palette" shouldFilter={false} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-border px-3">
              <Search className="size-4 text-fg-subtle" aria-hidden />
              <Command.Input value={query} onValueChange={setQuery} placeholder={repoId ? "Search pages, files and symbols…" : "Search pages…"} className="h-12 flex-1 bg-transparent text-sm outline-none placeholder:text-fg-subtle" />
            </div>
            <Command.List className="max-h-[60vh] overflow-auto p-1.5">
              <Command.Empty className="px-3 py-6 text-center text-sm text-fg-muted">No matches.</Command.Empty>
              {searchable && hits.length ? (
                <Command.Group heading="In this repository" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle">
                  {hits.map((h) => (
                    <Command.Item
                      key={`${h.type}-${h.id}`}
                      value={`${h.type}-${h.id}`}
                      className={item}
                      onSelect={() => go(h.type === "file" ? `/repos/${repoId}/atlas?node=${encodeURIComponent(`file:${h.path}`)}` : `/repos/${repoId}/source?file=${h.fileId}&line=${h.startLine ?? 1}`)}
                    >
                      {h.type === "file" ? <FileCode2 className="size-4 text-primary" aria-hidden /> : <Braces className="size-4 text-info" aria-hidden />}
                      <span className="truncate font-mono text-[13px] text-fg">{h.type === "file" ? h.path : h.name}</span>
                      {h.type === "symbol" ? <span className="ml-auto truncate font-mono text-xs text-fg-subtle">{h.path}:{h.startLine}</span> : null}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {searchable && hits.length ? (
                <Command.Group heading="Impact of a change" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle">
                  {hits.slice(0, 3).map((h) => (
                    <Command.Item key={`impact-${h.type}-${h.id}`} value={`impact-${h.type}-${h.id}`} className={item} onSelect={() => go(`/repos/${repoId}/impact?${h.type === "file" ? `file=${h.fileId}` : `symbol=${h.id}`}`)}>
                      <GitFork className="size-4" aria-hidden />
                      <span className="truncate">What depends on <span className="font-mono text-fg">{h.type === "file" ? h.path : h.name}</span></span>
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {actions.length ? (
                <Command.Group heading="Views" className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle">
                  {actions.map((a) => (
                    <Command.Item key={a.label} value={a.label} className={item} onSelect={() => go(a.href)}>
                      <a.icon className="size-4" aria-hidden />
                      {a.label}
                    </Command.Item>
                  ))}
                </Command.Group>
              ) : null}
              {groups.map((g) => {
                const items = g.items.filter((i) => !query || i.label.toLowerCase().includes(query.toLowerCase()));
                if (!items.length) return null;
                return (
                  <Command.Group key={g.label} heading={g.label} className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-fg-subtle">
                    {items.map((i) => (
                      <Command.Item key={i.label} value={i.label} className={item} onSelect={() => go(i.href)}>
                        <i.icon className="size-4" aria-hidden />
                        {i.label}
                      </Command.Item>
                    ))}
                  </Command.Group>
                );
              })}
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
