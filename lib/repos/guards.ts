import "server-only";
import { ApiError } from "@/lib/security/api";
import type { schema } from "@/lib/db";

export function requireReady(repo: typeof schema.repository.$inferSelect) {
  if (repo.status !== "ready") {
    throw new ApiError(409, "conflict", repo.status === "failed" ? "Indexing failed for this repository. Re-index it first." : "This repository is still being indexed.");
  }
}
