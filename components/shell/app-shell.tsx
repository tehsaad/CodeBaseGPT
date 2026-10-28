"use client";
import { Menu, Search } from "lucide-react";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Logo } from "@/components/brand/logo";
import { Kbd } from "@/components/ui/misc";
import { Sheet } from "@/components/ui/sheet";
import { TooltipProvider } from "@/components/ui/tooltip";
import { CommandPalette } from "./command-palette";
import { NavList } from "./nav";
import { UserMenu } from "./user-menu";

function SearchButton({ compact }: { compact?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event("cbg-open-palette"))}
      className="flex w-full cursor-pointer items-center gap-2 rounded-md border border-border bg-surface-2 px-2.5 py-1.5 text-[13px] text-fg-subtle hover:border-border-strong hover:text-fg-muted max-md:size-11 max-md:justify-center max-md:p-0"
      aria-label="Open command palette"
    >
      <Search className="size-4" aria-hidden />
      {compact ? null : (
        <>
          <span className="flex-1 text-left">Search…</span>
          <Kbd>⌘K</Kbd>
        </>
      )}
    </button>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  return (
    <TooltipProvider>
      <a href="#main" className="sr-only focus:not-sr-only focus:fixed focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-primary-fill focus:px-3 focus:py-2 focus:text-on-primary">
        Skip to content
      </a>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-[248px] shrink-0 flex-col border-r border-border bg-surface lg:flex">
          <div className="px-4 pb-3 pt-4">
            <Link href="/dashboard" aria-label="CodeBaseGPT overview">
              <Logo />
            </Link>
          </div>
          <div className="px-3 pb-3">
            <SearchButton />
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-4">
            <NavList />
          </div>
          <div className="border-t border-border p-2">
            <UserMenu />
          </div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-border bg-surface/90 px-3 backdrop-blur lg:hidden">
            <button type="button" className="grid size-11 cursor-pointer place-items-center rounded-md text-fg-muted hover:bg-surface-2" aria-label="Open navigation" onClick={() => setMobileOpen(true)}>
              <Menu className="size-5" />
            </button>
            <Link href="/dashboard" className="flex-1" aria-label="CodeBaseGPT overview">
              <Logo />
            </Link>
            <SearchButton compact />
          </header>
          <main id="main" className="min-w-0 flex-1">
            {children}
          </main>
        </div>
      </div>

      <Sheet open={mobileOpen} onOpenChange={setMobileOpen} side="left" title={<Logo />}>
        <div className="flex h-full flex-col">
          <div className="flex-1 p-3">
            <NavList onNavigate={() => setMobileOpen(false)} />
          </div>
          <div className="border-t border-border p-2">
            <UserMenu />
          </div>
        </div>
      </Sheet>
      <CommandPalette />
    </TooltipProvider>
  );
}
