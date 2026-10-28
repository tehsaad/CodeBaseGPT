"use client";
import { createContext, use, useEffect, useRef, type ReactNode } from "react";
import useSWR from "swr";
import { api, ClientApiError, fetcher, type IndexingJob, type Repository } from "@/lib/client/api";
import { rememberRepo } from "@/lib/client/last-repo";
import { isIndexing } from "./status";

type Ctx = { repo: Repository; job: IndexingJob | null; refresh: () => Promise<unknown> };
type Detail = { repository: Repository; job: IndexingJob | null };

const RepoContext = createContext<Ctx | null>(null);

export function useRepo() {
  const ctx = use(RepoContext);
  if (!ctx) throw new Error("useRepo must be used inside a repository route");
  return ctx;
}

export function useRepoDetail(id: string) {
  return useSWR<Detail, ClientApiError>(`/api/repos/${id}`, fetcher, { revalidateOnFocus: false });
}

/** Keeps indexing moving while a page is open: each step call processes a leased batch server-side. */
function useIndexingDriver(id: string, data: Detail | undefined, mutate: (d?: Detail) => Promise<unknown>) {
  const running = useRef(false);
  const active = data && (isIndexing(data.repository.status) || (data.job && (data.job.status === "queued" || data.job.status === "running")));
  useEffect(() => {
    if (!active || running.current) return;
    let cancelled = false;
    running.current = true;
    (async () => {
      while (!cancelled) {
        try {
          const res = await api<Detail>(`/api/repos/${id}/index`, { method: "POST", body: JSON.stringify({ action: "step" }) });
          await mutate(res);
          const done = !res.job || ["succeeded", "failed", "cancelled"].includes(res.job.status);
          if (done && !isIndexing(res.repository.status)) break;
          if (done) await mutate();
        } catch {
          await new Promise((r) => setTimeout(r, 4000));
        }
        await new Promise((r) => setTimeout(r, 1200));
      }
      running.current = false;
    })();
    return () => {
      cancelled = true;
    };
  }, [active, id, mutate]);
}

export function RepoProvider({ id, children, fallback, error }: { id: string; children: ReactNode; fallback: ReactNode; error: (e: ClientApiError) => ReactNode }) {
  const { data, error: err, mutate } = useRepoDetail(id);
  useIndexingDriver(id, data, (d) => (d ? mutate(d, { revalidate: false }) : mutate()));
  useEffect(() => {
    if (data) rememberRepo({ id: data.repository.id, name: data.repository.fullName });
  }, [data]);
  if (err) return <>{error(err)}</>;
  if (!data) return <>{fallback}</>;
  return <RepoContext value={{ repo: data.repository, job: data.job, refresh: () => mutate() }}>{children}</RepoContext>;
}
