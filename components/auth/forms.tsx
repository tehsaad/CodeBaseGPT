"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { z } from "zod";
import { authClient } from "@/lib/auth/client";
import { Button } from "@/components/ui/button";
import { Field, Input } from "@/components/ui/field";
import { Notice } from "@/components/ui/misc";
import { AuthCard, Divider } from "./auth-card";
import { OAuthButtons } from "./oauth-buttons";

function safeNext(raw: string | null) {
  return raw && raw.startsWith("/") && !raw.startsWith("//") && !raw.startsWith("/\\") ? raw : "/dashboard";
}

function messageFor(status: number | undefined, fallback: string) {
  if (status === 429) return "Too many attempts. Wait a minute and try again.";
  return fallback;
}

export function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(params.get("error") === "oauth" ? "Sign-in with that provider was cancelled or failed." : null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setError(null);
    setLoading(true);
    const { error: err } = await authClient.signIn.email({ email: email.trim(), password });
    if (err) {
      // Generic on purpose: never reveal whether an account exists.
      setError(messageFor(err.status, "Email or password is incorrect."));
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="Sign in"
      subtitle="Welcome back. Pick up where you left off."
      footer={
        <>
          New here?{" "}
          <Link className="font-medium text-primary hover:underline" href={`/sign-up${next !== "/dashboard" ? `?next=${encodeURIComponent(next)}` : ""}`}>
            Create an account
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} />
      <Divider label="or with email" />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Email">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />}
        </Field>
        <Field label="Password">
          {({ id, describedBy }) => <Input id={id} aria-describedby={describedBy} type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} />}
        </Field>
        {error ? <Notice tone="danger" title={error} /> : null}
        <Button type="submit" variant="primary" className="w-full" loading={loading} disabled={!email || !password}>
          Sign in
        </Button>
        <p className="text-center text-xs">
          <Link href="/forgot-password" className="text-fg-muted hover:text-fg hover:underline">
            Forgot your password?
          </Link>
        </p>
      </form>
    </AuthCard>
  );
}

const SignUpSchema = z
  .object({
    name: z.string().trim().min(1, "Enter your name").max(80),
    email: z.email("Enter a valid email address"),
    password: z.string().min(10, "Use at least 10 characters").max(128, "Use at most 128 characters"),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords don't match" });

export function SignUpForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [values, setValues] = useState({ name: "", email: "", password: "", confirm: "" });
  const [errors, setErrors] = useState<Partial<Record<keyof typeof values, string>>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const set = (k: keyof typeof values) => (e: React.ChangeEvent<HTMLInputElement>) => setValues((v) => ({ ...v, [k]: e.target.value }));

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (loading) return;
    setFormError(null);
    const parsed = SignUpSchema.safeParse(values);
    if (!parsed.success) {
      setErrors(Object.fromEntries(parsed.error.issues.map((i) => [i.path[0], i.message])));
      return;
    }
    setErrors({});
    setLoading(true);
    const { error } = await authClient.signUp.email({ name: parsed.data.name, email: parsed.data.email, password: parsed.data.password });
    if (error) {
      setFormError(messageFor(error.status, "We couldn't create that account. If you already have one, sign in instead."));
      setLoading(false);
      return;
    }
    router.replace(next);
    router.refresh();
  }

  return (
    <AuthCard
      title="Create your account"
      subtitle="Import a repository and start exploring in a couple of minutes."
      footer={
        <>
          Already have an account?{" "}
          <Link className="font-medium text-primary hover:underline" href="/sign-in">
            Sign in
          </Link>
        </>
      }
    >
      <OAuthButtons next={next} />
      <Divider label="or with email" />
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        <Field label="Name" error={errors.name}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} autoComplete="name" value={values.name} onChange={set("name")} />}
        </Field>
        <Field label="Email" error={errors.email}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="email" autoComplete="email" value={values.email} onChange={set("email")} />}
        </Field>
        <Field label="Password" hint="At least 10 characters. A short passphrase works well." error={errors.password}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="password" autoComplete="new-password" value={values.password} onChange={set("password")} />}
        </Field>
        <Field label="Confirm password" error={errors.confirm}>
          {({ id, describedBy, invalid }) => <Input id={id} aria-describedby={describedBy} aria-invalid={invalid} type="password" autoComplete="new-password" value={values.confirm} onChange={set("confirm")} />}
        </Field>
        {formError ? <Notice tone="danger" title={formError} /> : null}
        <Button type="submit" variant="primary" className="w-full" loading={loading}>
          Create account
        </Button>
      </form>
    </AuthCard>
  );
}
