import "server-only";
import { languageLabel } from "@/lib/code-intelligence/languages";
import { getDb, schema } from "@/lib/db";
import { searchStatus } from "@/lib/env";
import { describeSearchError, webSearch } from "@/lib/search/provider";
import { extractErrorSignature, stackFrameSymbols, suggestQueries } from "@/lib/search/queries";
import { log } from "@/lib/observability/log";
import { retrieve, type Focus } from "./retrieval";
import type { CbgDataParts, WebItem } from "./types";
import type { WebEvidence } from "./prompts";

type Repo = typeof schema.repository.$inferSelect;

export async function repoLanguages(repo: Repo) {
  const db = await getDb();
  const { sql } = await import("drizzle-orm");
  const rows = (await db.execute(sql`select language, sum(line_count)::int as n from repo_file where repository_id = ${repo.id} and language in ('typescript','javascript','python','java','c','cpp') group by language order by n desc`)) as unknown;
  const list = Array.isArray(rows) ? rows : ((rows as { rows: unknown[] }).rows ?? []);
  return (list as { language: string }[]).map((r) => languageLabel(r.language));
}

/** Repository evidence first, then deterministic search suggestions the student can edit. */
export async function planStuck(repo: Repo, input: { problem: string; errorText?: string; code?: string; focus?: Focus }) {
  const signature = extractErrorSignature(input.errorText);
  const frames = stackFrameSymbols(input.errorText).map((n) => `\`${n}\``).join(" ");
  const question = [input.problem, signature, frames, input.code?.slice(0, 500)].filter(Boolean).join("\n");
  const evidence = await retrieve({ repoId: repo.id, question, focus: input.focus, limit: 8, charBudget: 16_000 });
  const languages = await repoLanguages(repo);
  const queries = suggestQueries({ problem: input.problem, errorText: input.errorText, languages, frameworks: repo.manifest?.frameworks ?? [] });
  const s = searchStatus();
  return { evidence, queries, signature, search: { configured: s.configured, provider: s.provider, missing: s.missing } };
}

/** Runs the chosen queries (max 3), merges and dedupes results, and persists them for the user. */
export async function runWebResearch(opts: { ownerId: string; repoId: string; conversationId: string | null; queries: string[] }): Promise<{ part: CbgDataParts["web"]; evidence: WebEvidence[] }> {
  const queries = opts.queries.slice(0, 3);
  if (!queries.length) return { part: { status: "skipped", queries: [], items: [], message: "No search query was provided." }, evidence: [] };
  try {
    const settled = await Promise.allSettled(queries.map((q) => webSearch(q, 5)));
    const ok = settled.filter((r): r is PromiseFulfilledResult<Awaited<ReturnType<typeof webSearch>>> => r.status === "fulfilled");
    if (!ok.length) throw (settled[0] as PromiseRejectedResult).reason;
    const seen = new Set<string>();
    const merged = ok
      .flatMap((r, qi) => r.value.results.map((x) => ({ ...x, query: queries[qi], provider: r.value.provider })))
      .sort((a, b) => b.score - a.score)
      .filter((r) => (seen.has(r.url) ? false : (seen.add(r.url), true)))
      .slice(0, 8);
    const db = await getDb();
    const stored = merged.length
      ? await db
          .insert(schema.webResult)
          .values(merged.map((r) => ({ ownerId: opts.ownerId, repositoryId: opts.repoId, conversationId: opts.conversationId, provider: r.provider, query: r.query, title: r.title, url: r.url, domain: r.domain, snippet: r.snippet, publishedAt: r.publishedAt })))
          .returning({ id: schema.webResult.id })
      : [];
    const items: WebItem[] = merged.map((r, i) => ({ label: `W${i + 1}`, id: stored[i]?.id, title: r.title, url: r.url, domain: r.domain, snippet: r.snippet, publishedAt: r.publishedAt }));
    return {
      part: { status: "ok", provider: ok[0].value.provider, queries, items, message: items.length ? undefined : "The search returned no usable results." },
      evidence: items.map((i) => ({ label: i.label, title: i.title, url: i.url, domain: i.domain, snippet: i.snippet, publishedAt: i.publishedAt })),
    };
  } catch (error) {
    const d = describeSearchError(error);
    log("warn", "stuck.search_failed", { code: d.code, error });
    return { part: { status: d.code === "search_not_configured" ? "not_configured" : "failed", message: d.message, queries, items: [] }, evidence: [] };
  }
}
