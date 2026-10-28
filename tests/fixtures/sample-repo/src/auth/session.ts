import { createHmac } from "node:crypto";
import { findUserByEmail, type User } from "@/lib/db";
import { verifyPassword } from "./password";

export type Session = { userId: string; expiresAt: number };

const SECRET = process.env.SESSION_SECRET ?? "";

export function signSession(session: Session): string {
  const payload = Buffer.from(JSON.stringify(session)).toString("base64url");
  const mac = createHmac("sha256", SECRET).update(payload).digest("base64url");
  return `${payload}.${mac}`;
}

export function readSession(token: string | undefined): Session | null {
  if (!token) return null;
  const [payload, mac] = token.split(".");
  if (!payload || !mac) return null;
  const expected = createHmac("sha256", SECRET).update(payload).digest("base64url");
  if (expected !== mac) return null;
  const session = JSON.parse(Buffer.from(payload, "base64url").toString()) as Session;
  return session.expiresAt > Date.now() ? session : null;
}

export async function signIn(email: string, password: string): Promise<string | null> {
  const user: User | null = await findUserByEmail(email);
  if (!user || !(await verifyPassword(password, user.passwordHash))) return null;
  return signSession({ userId: user.id, expiresAt: Date.now() + 3600_000 });
}
