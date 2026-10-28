"use client";
import { Moon, Sun } from "lucide-react";
import { useState } from "react";
import useSWR from "swr";
import { authClient } from "@/lib/auth/client";
import { fetcher } from "@/lib/client/api";
import { setTheme, useTheme } from "@/lib/client/last-repo";
import { GitHubIcon } from "@/components/brand/github-icon";
import { Button } from "@/components/ui/button";
import { Notice, Panel, SectionHeader, Skeleton } from "@/components/ui/misc";
import { useProviderStatus } from "@/components/chat/use-status";

type Account = { providerId: string; scopes?: string[] };

export function SettingsPage() {
  const { data: session } = authClient.useSession();
  const { data: status } = useProviderStatus();
  const { data: accounts, mutate } = useSWR<Account[]>("/api/auth/list-accounts", fetcher);
  const theme = useTheme();
  const [linking, setLinking] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const github = accounts?.find((a) => a.providerId === "github");
  const hasRepoScope = github?.scopes?.some((s) => s === "repo");

  async function connectGitHub(withPrivate: boolean) {
    setLinking(true);
    const res = await authClient.linkSocial({ provider: "github", callbackURL: "/settings", scopes: withPrivate ? ["repo"] : undefined });
    if (res?.error) {
      setMsg("Couldn't start the GitHub connection. Try again.");
      setLinking(false);
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6 lg:py-8">
      <SectionHeader title="Settings" />
      <Panel className="p-4">
        <h2 className="text-sm font-semibold">Profile</h2>
        {session ? (
          <dl className="mt-3 grid gap-2 text-[13px] sm:grid-cols-[120px_1fr]">
            <dt className="text-fg-muted">Name</dt><dd>{session.user.name}</dd>
            <dt className="text-fg-muted">Email</dt><dd className="break-all">{session.user.email}</dd>
            <dt className="text-fg-muted">Sign-in methods</dt><dd>{accounts ? accounts.map((a) => (a.providerId === "credential" ? "email & password" : a.providerId)).join(", ") : "…"}</dd>
          </dl>
        ) : <Skeleton className="mt-3 h-16" />}
      </Panel>
      <Panel className="p-4">
        <h2 className="text-sm font-semibold">Appearance</h2>
        <div className="mt-3 flex gap-2" role="radiogroup" aria-label="Theme">
          {(["dark", "light"] as const).map((t) => (
            <Button key={t} role="radio" aria-checked={theme === t} variant={theme === t ? "primary" : "secondary"} size="sm" onClick={() => setTheme(t)}>
              {t === "dark" ? <Moon /> : <Sun />} {t === "dark" ? "Dark" : "Light"}
            </Button>
          ))}
        </div>
      </Panel>
      <Panel className="p-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold"><GitHubIcon /> GitHub access</h2>
        <p className="mt-1 text-[13px] text-fg-muted">Public repositories import without connecting. To import private repositories, grant the <span className="font-mono">repo</span> scope — GitHub has no read-only private scope for OAuth apps, so only grant it if you need it. Tokens are encrypted at rest and never sent to the browser.</p>
        {!status ? <Skeleton className="mt-3 h-9 w-48" /> : !status.oauth.github ? (
          <Notice tone="warning" className="mt-3" title="GitHub OAuth isn't configured on this server">Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET (see docs/authentication.md).</Notice>
        ) : (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="text-[13px]">{github ? (hasRepoScope ? "Connected with private repository access." : "Connected (public repositories only).") : "Not connected."}</span>
            {!github ? <Button size="sm" loading={linking} onClick={() => connectGitHub(false)}>Connect GitHub</Button> : null}
            {!hasRepoScope ? <Button size="sm" variant="primary" loading={linking} onClick={() => connectGitHub(true)}>Allow private repositories</Button> : null}
            {github ? <Button size="sm" variant="ghost" onClick={() => mutate()}>Refresh</Button> : null}
          </div>
        )}
        {msg ? <p className="mt-2 text-xs text-danger">{msg}</p> : null}
      </Panel>
      <Panel className="p-4">
        <h2 className="text-sm font-semibold">Data</h2>
        <p className="mt-1 text-[13px] text-fg-muted">Removing a repository on the Repositories page deletes its files, symbols, embeddings, conversations and citations. Imported code is never executed and never shared with other accounts.</p>
      </Panel>
    </div>
  );
}
