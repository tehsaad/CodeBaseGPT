import "server-only";
import { env, searchStatus } from "@/lib/env";
import { displayDomain, safeExternalUrl } from "./url";

export type WebResult = {
  title: string;
  url: string;
  domain: string;
  snippet: string;
  publishedAt: string | null;
  score: number;
};

export class SearchNotConfiguredError extends Error {
  constructor(public missing: string[]) {
    super(`Web search is not configured. Missing: ${missing.join(", ")}`);
  }
}

export class SearchProviderError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const AUTHORITATIVE = [
  /(^|\.)developer\.mozilla\.org$/, /(^|\.)docs\.python\.org$/, /(^|\.)nodejs\.org$/, /(^|\.)typescriptlang\.org$/,
  /(^|\.)react\.dev$/, /(^|\.)nextjs\.org$/, /(^|\.)docs\.oracle\.com$/, /(^|\.)cppreference\.com$/, /(^|\.)learn\.microsoft\.com$/,
  /(^|\.)docs\.djangoproject\.com$/, /(^|\.)flask\.palletsprojects\.com$/, /(^|\.)fastapi\.tiangolo\.com$/, /(^|\.)docs\.spring\.io$/,
  /(^|\.)pypi\.org$/, /(^|\.)npmjs\.com$/, /(^|\.)github\.com$/, /(^|\.)stackoverflow\.com$/, /(^|\.)vuejs\.org$/, /(^|\.)vitejs\.dev$/,
];

export function authorityBoost(domain: string) {
  return AUTHORITATIVE.some((re) => re.test(domain)) ? 0.25 : 0;
}

type Raw = { title?: unknown; url?: unknown; snippet?: unknown; publishedAt?: unknown; score?: unknown };

/** Validates provider output: drops results with unsafe URLs, strips markup, and bounds lengths. */
export function normalizeResults(raw: Raw[]): WebResult[] {
  const seen = new Set<string>();
  const out: WebResult[] = [];
  for (const r of raw) {
    const url = safeExternalUrl(r.url);
    if (!url) continue;
    const key = url.origin + url.pathname;
    if (seen.has(key)) continue;
    seen.add(key);
    const domain = displayDomain(url);
    const clean = (v: unknown, n: number) =>
      typeof v === "string" ? v.replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim().slice(0, n) : "";
    const title = clean(r.title, 200) || domain;
    const published = typeof r.publishedAt === "string" && !Number.isNaN(Date.parse(r.publishedAt)) ? new Date(r.publishedAt).toISOString().slice(0, 10) : null;
    out.push({ title, url: url.toString(), domain, snippet: clean(r.snippet, 600), publishedAt: published, score: (typeof r.score === "number" ? r.score : 0.5) + authorityBoost(domain) });
  }
  return out.sort((a, b) => b.score - a.score);
}

async function tavily(query: string, max: number, key: string): Promise<Raw[]> {
  const res = await fetch("https://api.tavily.com/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({ query, search_depth: "basic", max_results: max, include_answer: false, include_raw_content: false }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new SearchProviderError(res.status, `Tavily responded ${res.status}`);
  const json = (await res.json()) as { results?: { title?: string; url?: string; content?: string; score?: number; published_date?: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.content, score: r.score, publishedAt: r.published_date }));
}

async function exa(query: string, max: number, key: string): Promise<Raw[]> {
  const res = await fetch("https://api.exa.ai/search", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key },
    body: JSON.stringify({ query, numResults: max, type: "auto", contents: { highlights: { numSentences: 3 } } }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!res.ok) throw new SearchProviderError(res.status, `Exa responded ${res.status}`);
  const json = (await res.json()) as { results?: { title?: string; url?: string; highlights?: string[]; text?: string; score?: number; publishedDate?: string }[] };
  return (json.results ?? []).map((r) => ({ title: r.title, url: r.url, snippet: r.highlights?.join(" … ") ?? r.text, score: r.score, publishedAt: r.publishedDate }));
}

type SearchFn = (query: string, max: number) => Promise<Raw[]>;
let override: { provider: string; fn: SearchFn } | null = null;

export function setSearchOverrideForTests(o: { provider: string; fn: SearchFn } | null) {
  override = o;
}

export async function webSearch(query: string, maxResults = 6): Promise<{ provider: string; results: WebResult[] }> {
  const q = query.trim().slice(0, 300);
  if (override) return { provider: override.provider, results: normalizeResults(await override.fn(q, maxResults)).slice(0, maxResults) };
  const status = searchStatus();
  if (!status.configured) throw new SearchNotConfiguredError(status.missing);
  const e = env();
  try {
    const raw = status.provider === "exa" ? await exa(q, maxResults, e.EXA_API_KEY!) : await tavily(q, maxResults, e.TAVILY_API_KEY!);
    return { provider: status.provider!, results: normalizeResults(raw).slice(0, maxResults) };
  } catch (error) {
    if (error instanceof SearchProviderError) throw error;
    throw new SearchProviderError(504, "The search provider did not respond in time");
  }
}

export function describeSearchError(error: unknown) {
  if (error instanceof SearchNotConfiguredError) return { code: "search_not_configured", message: "Web search isn't configured on this server (set TAVILY_API_KEY or EXA_API_KEY)." };
  if (error instanceof SearchProviderError) {
    if (error.status === 401 || error.status === 403) return { code: "search_auth", message: "The search provider rejected the API key." };
    if (error.status === 429) return { code: "search_rate_limited", message: "The search provider is rate limiting requests. Try again shortly." };
    return { code: "search_failed", message: "Web search failed. Continuing with repository evidence only." };
  }
  return { code: "search_failed", message: "Web search failed. Continuing with repository evidence only." };
}
