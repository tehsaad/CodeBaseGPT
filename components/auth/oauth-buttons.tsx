"use client";
import { useState } from "react";
import useSWR from "swr";
import { authClient } from "@/lib/auth/client";
import { fetcher } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { GitHubIcon } from "@/components/brand/github-icon";

type Status = { oauth: { github: boolean; google: boolean; email: boolean } };

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden>
      <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.67-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.4 3.62v3h3.88c2.27-2.09 3.57-5.17 3.57-8.81Z" />
      <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.94-2.92l-3.88-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.71-4.95H1.28v3.1A12 12 0 0 0 12 24Z" />
      <path fill="#FBBC05" d="M5.29 14.28a7.2 7.2 0 0 1 0-4.56v-3.1H1.28a12 12 0 0 0 0 10.76l4-3.1Z" />
      <path fill="#EA4335" d="M12 4.77c1.76 0 3.34.61 4.59 1.8l3.44-3.44A11.97 11.97 0 0 0 1.28 6.62l4 3.1C6.23 6.88 8.88 4.77 12 4.77Z" />
    </svg>
  );
}

export function OAuthButtons({ next }: { next: string }) {
  const { data } = useSWR<Status>("/api/status", fetcher);
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const start = async (provider: "github" | "google") => {
    setPending(provider);
    setError(null);
    const res = await authClient.signIn.social({ provider, callbackURL: next, errorCallbackURL: "/sign-in" });
    if (res?.error) {
      setError("Couldn't start sign-in with that provider. Try again.");
      setPending(null);
    }
  };
  const providers = [
    { id: "github" as const, label: "GitHub", icon: <GitHubIcon />, enabled: data?.oauth.github },
    { id: "google" as const, label: "Google", icon: <GoogleIcon />, enabled: data?.oauth.google },
  ];
  const anyDisabled = data && providers.some((p) => !p.enabled);
  return (
    <div className="space-y-2">
      <div className="grid grid-cols-2 gap-2">
        {providers.map((p) => (
          <Button key={p.id} type="button" variant="secondary" disabled={!data || !p.enabled} loading={pending === p.id} onClick={() => start(p.id)} aria-describedby={anyDisabled ? "oauth-config-hint" : undefined}>
            {pending === p.id ? null : p.icon}
            {p.label}
          </Button>
        ))}
      </div>
      {anyDisabled ? (
        <p id="oauth-config-hint" className="text-xs text-fg-muted">
          {providers.filter((p) => !p.enabled).map((p) => p.label).join(" and ")} sign-in isn&apos;t configured on this server yet (see <span className="font-mono">docs/authentication.md</span>).
        </p>
      ) : null}
      {error ? <p role="alert" className="text-xs text-danger">{error}</p> : null}
    </div>
  );
}
