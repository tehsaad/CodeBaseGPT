"use client";
import { BarChart3, FileArchive, LayoutGrid, LifeBuoy, MessageSquareText, Network, ScrollText } from "lucide-react";
import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { GitHubIcon } from "@/components/brand/github-icon";
import { cn } from "@/lib/client/cn";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Skeleton } from "@/components/ui/misc";
import { SourceDrawerProvider } from "@/components/source/source-drawer";
import { RepoProvider, useRepo } from "./repo-context";
import { RepoStatusBadge } from "./status";

const TABS = [
  { seg: "", label: "Overview", icon: LayoutGrid },
  { seg: "atlas", label: "Atlas", icon: Network },
  { seg: "ask", label: "Ask", icon: MessageSquareText },
  { seg: "stuck", label: "I'm stuck", icon: LifeBuoy },
  { seg: "insights", label: "Insights", icon: BarChart3 },
  { seg: "source", label: "Source", icon: ScrollText },
];

function Header() {
  const { repo } = useRepo();
  const pathname = usePathname();
  const base = `/repos/${repo.id}`;
  return (
    <div className="border-b border-border bg-surface/60">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-4 pt-3 sm:px-6">
        {repo.source === "github" ? <GitHubIcon className="size-4 text-fg-muted" /> : <FileArchive className="size-4 text-fg-muted" aria-hidden />}
        <h1 className="min-w-0 truncate font-mono text-[15px] font-semibold">{repo.fullName}</h1>
        <RepoStatusBadge status={repo.status} />
        {repo.ref ? <span className="font-mono text-xs text-fg-subtle">{repo.ref}{repo.commitSha ? `@${repo.commitSha.slice(0, 7)}` : ""}</span> : null}
      </div>
      <nav aria-label="Repository sections" className="-mb-px flex gap-1 overflow-x-auto px-3 sm:px-5">
        {TABS.map((t) => {
          const href = t.seg ? `${base}/${t.seg}` : base;
          const active = t.seg ? pathname.startsWith(href) : pathname === base;
          return (
            <Link key={t.label} href={href} aria-current={active ? "page" : undefined} className={cn("flex shrink-0 items-center gap-1.5 border-b-2 px-2.5 py-2.5 text-[13px] transition-colors", active ? "border-primary text-fg" : "border-transparent text-fg-muted hover:text-fg")}>
              <t.icon className="size-4" aria-hidden />
              {t.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

export function RepoLayout({ children }: { children: ReactNode }) {
  const { id } = useParams<{ id: string }>();
  return (
    <RepoProvider
      id={id}
      fallback={
        <div className="space-y-3 p-6">
          <Skeleton className="h-6 w-72" />
          <Skeleton className="h-8 w-96" />
          <Skeleton className="h-64" />
        </div>
      }
      error={(e) => (
        <EmptyState icon={FileArchive} title={e.status === 404 ? "Repository not found" : "Couldn't load this repository"} action={<ButtonLink href="/repos">Back to repositories</ButtonLink>}>
          {e.status === 404 ? "It may have been removed, or it belongs to another account." : e.message}
        </EmptyState>
      )}
    >
      <SourceDrawerProvider repoId={id}>
        <div className="flex min-h-dvh flex-col max-lg:min-h-[calc(100dvh-3.5rem)]">
          <Header />
          <div className="flex min-h-0 flex-1 flex-col">{children}</div>
        </div>
      </SourceDrawerProvider>
    </RepoProvider>
  );
}
