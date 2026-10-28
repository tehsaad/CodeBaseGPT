import "server-only";
import { after } from "next/server";
import { log } from "@/lib/observability/log";

/** Continues work after the response is sent (Vercel keeps the function alive via waitUntil). */
export function runInBackground(task: () => Promise<unknown>) {
  if (process.env.NODE_ENV === "test") return;
  try {
    after(() => task().catch((error) => log("error", "background.failed", { error })));
  } catch {
    void task().catch((error) => log("error", "background.failed", { error }));
  }
}
