import "server-only";
import { headers } from "next/headers";
import { getDb } from "@/lib/db";
import { getAuth } from "./index";

export type SessionUser = { id: string; name: string; email: string; image?: string | null };

export async function getUserFromHeaders(h: Headers): Promise<SessionUser | null> {
  await getDb();
  const result = await getAuth().api.getSession({ headers: h });
  if (!result) return null;
  const { id, name, email, image } = result.user;
  return { id, name, email, image };
}

/** Reads the session for the current request (Server Components / Route Handlers). */
export async function getCurrentUser(): Promise<SessionUser | null> {
  return getUserFromHeaders(await headers());
}
