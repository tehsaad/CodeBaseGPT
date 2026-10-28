import type { indexingJob, repository } from "./schema";

/** Client-safe JSON shapes of server rows (dates arrive as strings). */
type Jsonify<T> = { [K in keyof T]: T[K] extends Date ? string : T[K] extends Date | null ? string | null : T[K] };

export type Repository = Jsonify<typeof repository.$inferSelect>;
export type IndexingJob = Jsonify<typeof indexingJob.$inferSelect>;
