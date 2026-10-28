import "server-only";
import { and, eq, isNotNull } from "drizzle-orm";
import { getDb, schema } from "@/lib/db";
import { repoFacts } from "./overview";

type Repo = typeof schema.repository.$inferSelect;

export type LearningTask = {
  id: string;
  kind: "read" | "trace" | "explore" | "ask" | "run";
  title: string;
  why: string;
  fileId?: string;
  path?: string;
  line?: number | null;
  chain?: { fileId: string; path: string }[];
  question?: string;
};
export type LearningStage = { id: string; title: string; goal: string; tasks: LearningTask[] };

const RUNNABLE = /\.(py|js|mjs|ts|c|cpp|cc|java)$/i;
const TEST = /(^|\/)(tests?|__tests__|spec)\/|[._-](test|spec)\.[a-z]+$|^test_|\/test_/i;

/**
 * A learning path derived from the index: README → entry points → the files everything depends on
 * → one real import chain → leaf modules to practise on. Every task points at a real file, so there
 * is nothing for a model to invent.
 */
export async function buildLearningPath(repo: Repo): Promise<LearningStage[]> {
  const db = await getDb();
  const facts = await repoFacts(repo);
  const files = await db.select({ id: schema.repoFile.id, path: schema.repoFile.path, language: schema.repoFile.language, lines: schema.repoFile.lineCount }).from(schema.repoFile).where(eq(schema.repoFile.repositoryId, repo.id));
  const pathOf = new Map(files.map((f) => [f.id, f.path]));
  const edges = await db.select({ from: schema.fileImport.fileId, to: schema.fileImport.targetFileId }).from(schema.fileImport).where(and(eq(schema.fileImport.repositoryId, repo.id), isNotNull(schema.fileImport.targetFileId)));
  const out = new Map<string, Set<string>>();
  const inDeg = new Map<string, number>();
  for (const e of edges) {
    if (!e.to || e.to === e.from) continue;
    if (!out.get(e.from)?.has(e.to)) inDeg.set(e.to, (inDeg.get(e.to) ?? 0) + 1);
    out.set(e.from, (out.get(e.from) ?? new Set()).add(e.to));
  }

  const stages: LearningStage[] = [];
  const orient: LearningTask[] = [];
  if (facts.readme) orient.push({ id: `read:${facts.readme.path}`, kind: "read", title: `Read ${facts.readme.path}`, why: "The authors' own description of the project and how to run it.", fileId: facts.readme.fileId, path: facts.readme.path });
  orient.push({ id: "explore:atlas", kind: "explore", title: "Skim the architecture map", why: `See how the ${facts.repo.files} files group into folders and which folders depend on which.` });
  for (const m of facts.modules.slice(0, 3)) orient.push({ id: `ask:module:${m.path}`, kind: "ask", title: `Ask what ${m.path}/ is responsible for`, why: `One of the largest modules (${m.files} files).`, question: `What is the ${m.path} folder responsible for, and how does the rest of the code use it?` });
  stages.push({ id: "orient", title: "1. Get oriented", goal: "Know what the project is for and how it is laid out.", tasks: orient });

  const entries = facts.entries.filter((e) => e.path !== "package.json").slice(0, 4);
  if (entries.length) {
    stages.push({ id: "entry", title: "2. Find where it starts", goal: "Know which code runs first.", tasks: entries.map((e) => ({ id: `read:${e.path}`, kind: "read" as const, title: `Read ${e.path}`, why: e.why, fileId: e.fileId, path: e.path, line: e.line })) });
  }

  if (facts.hubs.length) {
    stages.push({
      id: "core",
      title: `${stages.length + 1}. Learn the core`,
      goal: "Understand the files the rest of the code is built on.",
      tasks: facts.hubs.slice(0, 5).flatMap((h) => [
        { id: `read:${h.path}`, kind: "read" as const, title: `Read ${h.path}`, why: `${h.importers} file(s) import it.`, fileId: h.fileId, path: h.path },
        { id: `impact:${h.path}`, kind: "explore" as const, title: `See what depends on ${h.path.split("/").pop()}`, why: "Learn who relies on it before you ever change it.", fileId: h.fileId, path: h.path },
      ]),
    });
  }

  // One real dependency chain from an entry point down to a core file (shortest path over imports).
  const hubIds = new Set(facts.hubs.map((h) => h.fileId));
  for (const e of entries) {
    const prev = new Map<string, string | null>([[e.fileId, null]]);
    const q = [e.fileId];
    let hit: string | null = null;
    while (q.length && !hit) {
      const cur = q.shift()!;
      for (const n of out.get(cur) ?? []) {
        if (prev.has(n)) continue;
        prev.set(n, cur);
        if (hubIds.has(n)) {
          hit = n;
          break;
        }
        q.push(n);
      }
    }
    if (!hit) continue;
    const chain: { fileId: string; path: string }[] = [];
    for (let c: string | null = hit; c; c = prev.get(c) ?? null) chain.unshift({ fileId: c, path: pathOf.get(c)! });
    if (chain.length < 2) continue;
    stages.push({
      id: "trace",
      title: `${stages.length + 1}. Trace a path through the code`,
      goal: "Follow real imports from where execution starts to the core.",
      tasks: [
        { id: `trace:${chain.map((c) => c.path).join(">")}`, kind: "trace", title: `Follow ${chain[0].path.split("/").pop()} → ${chain[chain.length - 1].path.split("/").pop()}`, why: `${chain.length - 1} import step(s), all extracted from the source.`, chain, fileId: chain[0].fileId, path: chain[0].path },
        { id: `ask:trace:${chain[0].path}`, kind: "ask", title: "Ask how this path works", why: "Check your reading against a cited explanation.", question: `Walk me through how ${chain.map((c) => c.path).join(" → ")} work together.`, fileId: chain[0].fileId, path: chain[0].path },
      ],
    });
    break;
  }

  // Practice: small leaf files (imported by nobody, import little) in a runnable language.
  const leaves = files
    .filter((f) => RUNNABLE.test(f.path) && !TEST.test(f.path) && !inDeg.has(f.id) && f.lines >= 8 && f.lines <= 120 && (out.get(f.id)?.size ?? 0) === 0)
    .sort((a, b) => a.lines - b.lines)
    .slice(0, 3);
  if (leaves.length) {
    stages.push({
      id: "practice",
      title: `${stages.length + 1}. Practise`,
      goal: "Run and modify small, self-contained code safely.",
      tasks: leaves.map((f) => ({ id: `run:${f.path}`, kind: "run" as const, title: `Run ${f.path.split("/").pop()} in Code Tutor`, why: `${f.lines} lines with no internal imports, so it can run on its own (in an isolated sandbox; the repository is never modified).`, fileId: f.id, path: f.path })),
    });
  }
  return stages;
}
