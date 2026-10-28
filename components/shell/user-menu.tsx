"use client";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { ChevronsUpDown, LogOut, Moon, Settings, Sun } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth/client";
import { setTheme, useTheme } from "@/lib/client/last-repo";

export function UserMenu() {
  const { data, isPending } = authClient.useSession();
  const router = useRouter();
  const theme = useTheme();
  const user = data?.user;
  const initials = (user?.name ?? user?.email ?? "?").split(/\s+/).map((s) => s[0]).join("").slice(0, 2).toUpperCase();
  const itemCls = "flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm text-fg-muted outline-none data-[highlighted]:bg-surface-2 data-[highlighted]:text-fg";
  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full cursor-pointer items-center gap-2.5 rounded-md p-2 text-left hover:bg-surface-2" aria-label="Account menu">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{isPending ? "" : initials}</span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-medium">{user?.name ?? (isPending ? "Loading…" : "Signed out")}</span>
          <span className="block truncate text-xs text-fg-subtle">{user?.email}</span>
        </span>
        <ChevronsUpDown className="size-4 text-fg-subtle" aria-hidden />
      </Menu.Trigger>
      <Menu.Portal>
        <Menu.Content side="top" align="start" sideOffset={6} className="z-50 w-56 rounded-lg border border-border bg-surface p-1 shadow-overlay">
          <Menu.Item className={itemCls} onSelect={() => setTheme(theme === "dark" ? "light" : "dark")}>
            {theme === "dark" ? <Sun className="size-4" aria-hidden /> : <Moon className="size-4" aria-hidden />}
            {theme === "dark" ? "Light theme" : "Dark theme"}
          </Menu.Item>
          <Menu.Item asChild className={itemCls}>
            <Link href="/settings">
              <Settings className="size-4" aria-hidden /> Settings
            </Link>
          </Menu.Item>
          <Menu.Separator className="my-1 h-px bg-border" />
          <Menu.Item
            className={itemCls}
            onSelect={async () => {
              await authClient.signOut();
              router.replace("/sign-in");
              router.refresh();
            }}
          >
            <LogOut className="size-4" aria-hidden /> Sign out
          </Menu.Item>
        </Menu.Content>
      </Menu.Portal>
    </Menu.Root>
  );
}
