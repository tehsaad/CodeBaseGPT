"use client";
import type { IndexingJob as Job, Repository as Repo } from "@/lib/db/schema-types";

export class ClientApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export async function api<T = unknown>(path: string, init?: RequestInit): Promise<T> {
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers: { ...(init?.body && !(init.body instanceof FormData) ? { "content-type": "application/json" } : {}), ...init?.headers } });
  } catch {
    throw new ClientApiError(0, "network_error", "Couldn't reach the server. Check your connection and try again.");
  }
  if (res.status === 204) return undefined as T;
  const body = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && typeof window !== "undefined" && !location.pathname.startsWith("/sign-in")) {
      location.replace(`${location.origin}/sign-in?next=${encodeURIComponent(location.pathname + location.search)}`);
    }
    const err = body?.error ?? {};
    throw new ClientApiError(res.status, err.code ?? "error", err.message ?? `Request failed (${res.status})`, err.details);
  }
  return body as T;
}

export const fetcher = <T,>(url: string) => api<T>(url);

export type Repository = Repo;
export type IndexingJob = Job;
