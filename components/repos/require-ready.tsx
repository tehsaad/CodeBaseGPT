"use client";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";
import { ButtonLink } from "@/components/ui/button";
import { EmptyState, Panel } from "@/components/ui/misc";
import { IndexingProgress } from "./indexing-progress";
import { useRepo } from "./repo-context";

/** Shows indexing progress (or failure) until the repository is ready for the feature. */
export function RequireReady({ feature, children }: { feature: string; children: ReactNode }) {
  const { repo } = useRepo();
  if (repo.status === "ready") return <>{children}</>;
  return (
    <div className="mx-auto w-full max-w-xl px-4 py-10">
      <Panel className="p-5">
        <EmptyState icon={Loader2} title={repo.status === "failed" || repo.status === "cancelled" ? `${feature} needs a completed index` : `${feature} will be ready when indexing finishes`}>
          {repo.status === "failed" || repo.status === "cancelled" ? "Retry indexing below." : "We're parsing files and resolving imports from the actual source."}
        </EmptyState>
        <IndexingProgress />
        <div className="mt-4">
          <ButtonLink size="sm" variant="ghost" href={`/repos/${repo.id}`}>Repository overview</ButtonLink>
        </div>
      </Panel>
    </div>
  );
}
