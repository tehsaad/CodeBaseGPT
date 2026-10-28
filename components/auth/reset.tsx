"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import useSWR from "swr";
import { authClient } from "@/lib/auth/client";
import { fetcher } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice, Skeleton } from "@/components/ui/misc";
import { AuthCard } from "./auth-card";

export function ForgotPasswordForm() {
  const { data } = useSWR<{ oauth: { email: boolean } }>("/api/status", fetcher);
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error: err } = await authClient.requestPasswordReset({ email: email.trim(), redirectTo: "/reset-password" });
    setLoading(false);
    if (err?.status === 429) return setError("Too many requests. Try again in a few minutes.");
    // Same message whether or not the account exists.
    setSent(true);
  }

  return (
    <AuthCard title="Reset your password" footer={<Link href="/sign-in" className="text-primary hover:underline">Back to sign in</Link>}>
      {!data ? (
        <Skeleton className="h-24" />
      ) : !data.oauth.email ? (
        <Notice tone="warning" title="Password reset email isn't configured on this server">
          The administrator needs to set <span className="font-mono">RESEND_API_KEY</span> and <span className="font-mono">EMAIL_FROM</span>. Until then, sign in with GitHub or Google if your account is linked.
        </Notice>
      ) : sent ? (
        <Notice tone="info" title="Check your inbox">If an account exists for that email, a reset link is on its way. It expires in one hour.</Notice>
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="Email">{({ id }) => <Input id={id} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}</Field>
          {error ? <Notice tone="danger" title={error} /> : null}
          <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={!email}>
            Send reset link
          </Button>
        </form>
      )}
    </AuthCard>
  );
}

export function ResetPasswordForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get("token");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") ? "This reset link is invalid or has expired." : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (!token) return;
    if (password.length < 10) return setError("Use at least 10 characters.");
    setLoading(true);
    const { error: err } = await authClient.resetPassword({ newPassword: password, token });
    setLoading(false);
    if (err) return setError("This reset link is invalid or has expired. Request a new one.");
    router.replace("/sign-in");
  }

  return (
    <AuthCard title="Choose a new password">
      {!token ? (
        <Notice tone="danger" title="This reset link is missing its token." action={<Link className="text-primary hover:underline" href="/forgot-password">Request a new link</Link>} />
      ) : (
        <form onSubmit={onSubmit} className="space-y-4">
          <Field label="New password" hint="At least 10 characters." error={error}>
            {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />}
          </Field>
          <Button type="submit" variant="primary" className="w-full" loading={loading}>
            Update password
          </Button>
        </form>
      )}
    </AuthCard>
  );
}
