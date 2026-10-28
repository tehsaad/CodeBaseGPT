import "server-only";
import { sql } from "drizzle-orm";
import { getDb, rowsOf } from "@/lib/db";
import { ApiError } from "./api";

export const LIMITS = {
  chat: { max: 20, windowSec: 300 },
  stuck: { max: 10, windowSec: 300 },
  search: { max: 20, windowSec: 300 },
  import: { max: 5, windowSec: 600 },
  indexStep: { max: 600, windowSec: 600 },
  run: { max: 30, windowSec: 600 },
  tutor: { max: 20, windowSec: 600 },
} as const;

/** Fixed-window counter stored in Postgres so it holds across serverless instances. */
export async function enforceRateLimit(bucket: keyof typeof LIMITS, subject: string) {
  if (process.env.CBG_DISABLE_RATE_LIMIT === "1") return;
  const { max, windowSec } = LIMITS[bucket];
  const now = Date.now();
  const windowStart = now - (now % (windowSec * 1000));
  const key = `${bucket}:${subject}`;
  const db = await getDb();
  const result = await db.execute(sql`
    insert into app_rate_limit (key, window_start, count) values (${key}, ${windowStart}, 1)
    on conflict (key) do update set
      count = case when app_rate_limit.window_start = excluded.window_start then app_rate_limit.count + 1 else 1 end,
      window_start = excluded.window_start
    returning count`);
  const count = Number(rowsOf<{ count: number }>(result)[0]?.count ?? 0);
  if (count > max) {
    const retryAfter = Math.ceil((windowStart + windowSec * 1000 - now) / 1000);
    throw new ApiError(429, "rate_limited", `Too many requests. Try again in ${retryAfter}s.`, { retryAfter });
  }
}
