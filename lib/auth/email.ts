import "server-only";
import { env } from "@/lib/env";

/** Sends transactional email through Resend's HTTP API. Only called when RESEND_API_KEY and EMAIL_FROM are set. */
export async function sendEmail({ to, subject, text }: { to: string; subject: string; text: string }) {
  const { RESEND_API_KEY, EMAIL_FROM } = env();
  if (!RESEND_API_KEY || !EMAIL_FROM) throw new Error("Email provider is not configured");
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: EMAIL_FROM, to, subject, text }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`Email provider responded ${res.status}`);
}
