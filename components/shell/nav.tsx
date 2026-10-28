"use client";
import { BarChart3, Bookmark, FolderGit2, GraduationCap, History, LayoutDashboard, LifeBuoy, MessageSquareText, Network, ScrollText, Settings } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/client/cn";
import { useLastRepo } from "@/lib/client/last-repo";

export type NavItem = { href: string; label: string; icon: typeof Network; match: (p: string) => boolean; hint?: string };

export function useNav() {
  const pathname = usePathname();
  const fromPath = pathname.match(/^\/repos\/([0-9a-f-]{36})/)?.[1];
  const last = useLastRepo();
  const repoId = fromPath ?? last?.id ?? null;
  const repoHref = (section: string) => (repoId ? `/repos/${repoId}/${section}` : `/repos?pick=${section}`);
  const inRepo = (section: string) => (p: string) => Boolean(repoId) && p.startsWith(`/repos/${repoId}/${section}`);
  const groups: { label: string; items: NavItem[] }[] = [
    {
      label: "Workspace",
      items: [
        { href: "/dashboard", label: "Overview", icon: LayoutDashboard, match: (p) => p === "/dashboard" },
        { href: "/repos", label: "Repositories", icon: FolderGit2, match: (p) => p === "/repos" || (p.startsWith("/repos/") && p.split("/").length === 3) },
        { href: "/tutor", label: "Code Tutor", icon: GraduationCap, match: (p) => p.startsWith("/tutor") },
      ],
    },
    {
      label: repoId ? (fromPath ? "This repository" : (last?.name ?? "Repository")) : "Repository · pick one first",
      items: [
        { href: repoHref("atlas"), label: "Codebase Atlas", icon: Network, match: inRepo("atlas") },
        { href: repoHref("ask"), label: "Ask CodeBaseGPT", icon: MessageSquareText, match: inRepo("ask") },
        { href: repoHref("stuck"), label: "I'm stuck · Web research", icon: LifeBuoy, match: inRepo("stuck") },
        { href: repoHref("insights"), label: "Insights", icon: BarChart3, match: inRepo("insights") },
        { href: repoHref("source"), label: "Source files", icon: ScrollText, match: inRepo("source") },
      ],
    },
    {
      label: "Library",
      items: [
        { href: "/saved", label: "Saved", icon: Bookmark, match: (p) => p.startsWith("/saved") },
        { href: "/history", label: "History", icon: History, match: (p) => p.startsWith("/history") },
        { href: "/settings", label: "Settings", icon: Settings, match: (p) => p.startsWith("/settings") },
      ],
    },
  ];
  return { groups, pathname, repoId };
}

export function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const { groups, pathname } = useNav();
  return (
    <nav aria-label="Primary" className="space-y-5">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="mb-1.5 truncate px-2.5 text-[11px] font-medium uppercase tracking-wider text-fg-subtle">{g.label}</p>
          <ul className="space-y-0.5">
            {g.items.map((item) => {
              const active = item.match(pathname);
              return (
                <li key={item.label}>
                  <Link
                    href={item.href}
                    onClick={onNavigate}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13.5px] transition-colors duration-150 max-md:py-2.5",
                      active ? "bg-primary-soft text-fg" : "text-fg-muted hover:bg-surface-2 hover:text-fg",
                    )}
                  >
                    <item.icon className={cn("size-4 shrink-0", active ? "text-primary" : "text-fg-subtle group-hover:text-fg-muted")} aria-hidden />
                    <span className="truncate">{item.label}</span>
                    {item.hint ? <span className="ml-auto text-[10px] text-fg-subtle">{item.hint}</span> : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );
}
