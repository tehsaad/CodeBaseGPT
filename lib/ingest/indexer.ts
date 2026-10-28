import "server-only";
import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import { chunkFile } from "@/lib/code-intelligence/chunker";
import { detectLanguage } from "@/lib/code-intelligence/languages";
import { extract, type ExtractedImport } from "@/lib/code-intelligence/parser";
import { buildResolverContext, resolveImport } from "@/lib/code-intelligence/resolve";
import { getDb, rowsOf, schema, type Db } from "@/lib/db";
import { log } from "@/lib/observability/log";
import { embeddingsEnabled, embedTexts } from "@/lib/ai/embeddings";
import { detectManifest, type ArchiveResult } from "./archive";

const { repository, indexingJob, repoFile, codeSymbol, fileImport, symbolCall, codeChunk } = schema;

const PARSE_BATCH = 25;
const EMBED_BATCH = 48;
const LEASE_SECONDS = 90;
const MAX_ATTEMPTS = 3;

type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

/** Replaces a repository's files with a fresh archive snapshot and queues a parse job, atomically. */
export async function storeArchive(repoId: string, ownerId: string, archive: ArchiveResult) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.update(indexingJob).set({ status: "cancelled", finishedAt: new Date() }).where(and(eq(indexingJob.repositoryId, repoId), inArray(indexingJob.status, ["queued", "running"])));
    await tx.delete(repoFile).where(eq(repoFile.repositoryId, repoId));
    for (let i = 0; i < archive.files.length; i += 200) {
      await tx.insert(repoFile).values(archive.files.slice(i, i + 200).map((f) => ({ ...f, repositoryId: repoId })));
    }
    const skippedCount = Object.values(archive.skipped).reduce((a, b) => a + (b ?? 0), 0);
    await tx
      .update(repository)
      .set({
        status: "parsing",
        error: null,
        fileCount: archive.files.length,
        skippedCount,
        totalBytes: archive.totalBytes,
        totalLines: archive.files.reduce((a, f) => a + f.lineCount, 0),
        symbolCount: 0,
        edgeCount: 0,
        manifest: detectManifest(archive.files),
      })
      .where(eq(repository.id, repoId));
    const [job] = await tx
      .insert(indexingJob)
      .values({ repositoryId: repoId, ownerId, phase: "parse", total: archive.files.length, status: "queued" })
      .returning();
    return job;
  });
}

/** Re-parses already stored files (used for ZIP re-indexing, where there is no upstream to fetch). */
export async function requeueParse(repoId: string, ownerId: string) {
  const db = await getDb();
  return db.transaction(async (tx) => {
    await tx.update(indexingJob).set({ status: "cancelled", finishedAt: new Date() }).where(and(eq(indexingJob.repositoryId, repoId), inArray(indexingJob.status, ["queued", "running"])));
    await tx.update(repoFile).set({ parseStatus: "pending", parseError: null }).where(eq(repoFile.repositoryId, repoId));
    const [{ n }] = await tx.select({ n: sql<number>`count(*)::int` }).from(repoFile).where(eq(repoFile.repositoryId, repoId));
    await tx.update(repository).set({ status: "parsing", error: null }).where(eq(repository.id, repoId));
    const [job] = await tx.insert(indexingJob).values({ repositoryId: repoId, ownerId, phase: "parse", total: n, status: "queued" }).returning();
    return job;
  });
}

async function acquireLease(db: Db, jobId: string, ownerId: string) {
  const rows = rowsOf<{ id: string }>(
    await db.execute(sql`
      update indexing_job
         set lease_until = now() + make_interval(secs => ${LEASE_SECONDS}::int),
             status = 'running',
             started_at = coalesce(started_at, now())
       where id = ${jobId} and owner_id = ${ownerId}
         and status in ('queued', 'running')
         and (lease_until is null or lease_until < now())
      returning id`),
  );
  return rows.length > 0;
}

function storedSpecifier(i: ExtractedImport) {
  return i.kind === "include-system" ? `<${i.specifier}>` : i.specifier;
}

async function parseBatch(db: Db, repoId: string) {
  const files = await db
    .select({ id: repoFile.id, path: repoFile.path, content: repoFile.content })
    .from(repoFile)
    .where(and(eq(repoFile.repositoryId, repoId), eq(repoFile.parseStatus, "pending")))
    .orderBy(asc(repoFile.path))
    .limit(PARSE_BATCH);
  if (files.length === 0) return 0;

  const results = await Promise.all(
    files.map(async (f) => {
      const { parsed } = detectLanguage(f.path);
      if (!parsed) return { file: f, status: "unsupported" as const, extraction: null, error: null };
      try {
        return { file: f, status: "parsed" as const, extraction: await extract(f.content, parsed), error: null };
      } catch (error) {
        return { file: f, status: "error" as const, extraction: null, error: (error as Error).message.slice(0, 300) };
      }
    }),
  );

  await db.transaction(async (tx: Tx) => {
    const ids = files.map((f) => f.id);
    await tx.delete(codeChunk).where(inArray(codeChunk.fileId, ids));
    await tx.delete(symbolCall).where(inArray(symbolCall.fileId, ids));
    await tx.delete(fileImport).where(inArray(fileImport.fileId, ids));
    await tx.delete(codeSymbol).where(inArray(codeSymbol.fileId, ids));

    for (const r of results) {
      const symbols = r.extraction?.symbols ?? [];
      const symbolIds: string[] = [];
      if (symbols.length) {
        const inserted = await tx
          .insert(codeSymbol)
          .values(symbols.map((s) => ({ ...s, repositoryId: repoId, fileId: r.file.id })))
          .returning({ id: codeSymbol.id });
        symbolIds.push(...inserted.map((x) => x.id));
      }
      const imports = r.extraction?.imports ?? [];
      if (imports.length) {
        await tx.insert(fileImport).values(
          imports.map((i) => ({ repositoryId: repoId, fileId: r.file.id, specifier: storedSpecifier(i), names: i.names, line: i.line })),
        );
      }
      const calls = (r.extraction?.calls ?? []).slice(0, 2000);
      if (calls.length) {
        await tx.insert(symbolCall).values(
          calls.map((c) => ({
            repositoryId: repoId,
            fileId: r.file.id,
            calleeName: c.calleeName.slice(0, 200),
            line: c.line,
            callerSymbolId: c.callerIndex !== null ? symbolIds[c.callerIndex] : null,
          })),
        );
      }
      const chunks = chunkFile(r.file.path, r.file.content, symbols);
      if (chunks.length) {
        await tx.insert(codeChunk).values(
          chunks.map((c) => ({
            repositoryId: repoId,
            fileId: r.file.id,
            symbolId: c.symbolIndex !== null ? symbolIds[c.symbolIndex] : null,
            startLine: c.startLine,
            endLine: c.endLine,
            content: c.content,
            searchText: c.searchText,
          })),
        );
      }
      await tx.update(repoFile).set({ parseStatus: r.status, parseError: r.error }).where(eq(repoFile.id, r.file.id));
    }
  });
  return files.length;
}

async function bulkUpdate(db: Db | Tx, table: "file_import" | "symbol_call", rows: { id: string; target: string | null; kind?: string }[]) {
  for (let i = 0; i < rows.length; i += 500) {
    const part = rows.slice(i, i + 500);
    if (table === "file_import") {
      const values = sql.join(part.map((r) => sql`(${r.id}::uuid, ${r.target}::uuid, ${r.kind}::text)`), sql`, `);
      await db.execute(sql`update file_import f set target_file_id = v.t, kind = v.k from (values ${values}) as v(id, t, k) where f.id = v.id`);
    } else {
      const values = sql.join(part.map((r) => sql`(${r.id}::uuid, ${r.target}::uuid)`), sql`, `);
      await db.execute(sql`update symbol_call c set callee_symbol_id = v.t from (values ${values}) as v(id, t) where c.id = v.id`);
    }
  }
}

/** Resolves imports to files and calls to symbols across the whole repository. */
async function link(db: Db, repoId: string) {
  const files = await db.select({ id: repoFile.id, path: repoFile.path }).from(repoFile).where(eq(repoFile.repositoryId, repoId));
  const configs = await db
    .select({ path: repoFile.path, content: repoFile.content })
    .from(repoFile)
    .where(and(eq(repoFile.repositoryId, repoId), sql`${repoFile.path} ~ '(^|/)(tsconfig|jsconfig)\\.json$'`));
  const ctx = buildResolverContext(
    files.map((f) => f.path),
    configs.map((c) => ({ dir: c.path.includes("/") ? c.path.slice(0, c.path.lastIndexOf("/")) : ".", text: c.content })),
  );
  const idByPath = new Map(files.map((f) => [f.path, f.id]));
  const pathById = new Map(files.map((f) => [f.id, f.path]));

  const imports = await db
    .select({ id: fileImport.id, fileId: fileImport.fileId, specifier: fileImport.specifier })
    .from(fileImport)
    .where(eq(fileImport.repositoryId, repoId));
  const importUpdates = imports.map((i) => {
    const from = pathById.get(i.fileId)!;
    const lang = detectLanguage(from).parsed!;
    const system = i.specifier.startsWith("<");
    const spec = system ? i.specifier.slice(1, -1) : i.specifier;
    const res = resolveImport(ctx, from, lang, spec, system ? "include-system" : lang === "c" || lang === "cpp" ? "include-local" : "module");
    return { id: i.id, fileId: i.fileId, target: res.kind === "internal" ? (idByPath.get(res.targetPath) ?? null) : null, kind: res.kind };
  });
  await bulkUpdate(db, "file_import", importUpdates);

  const symbols = await db
    .select({ id: codeSymbol.id, fileId: codeSymbol.fileId, name: codeSymbol.name, kind: codeSymbol.kind })
    .from(codeSymbol)
    .where(eq(codeSymbol.repositoryId, repoId));
  const symbolsByFileName = new Map<string, string>();
  for (const s of symbols) {
    const key = `${s.fileId}:${s.name}`;
    if (!symbolsByFileName.has(key) || s.kind === "function" || s.kind === "class") symbolsByFileName.set(key, s.id);
  }
  const importedFiles = new Map<string, Set<string>>();
  for (const u of importUpdates) if (u.target) importedFiles.set(u.fileId, (importedFiles.get(u.fileId) ?? new Set()).add(u.target));

  const calls = await db
    .select({ id: symbolCall.id, fileId: symbolCall.fileId, calleeName: symbolCall.calleeName })
    .from(symbolCall)
    .where(eq(symbolCall.repositoryId, repoId));
  const callUpdates: { id: string; target: string | null }[] = [];
  for (const c of calls) {
    // Only resolve calls we can attribute statically: same file, or a file this file imports.
    let target = symbolsByFileName.get(`${c.fileId}:${c.calleeName}`) ?? null;
    if (!target) {
      for (const f of importedFiles.get(c.fileId) ?? []) {
        target = symbolsByFileName.get(`${f}:${c.calleeName}`) ?? null;
        if (target) break;
      }
    }
    if (target) callUpdates.push({ id: c.id, target });
  }
  await bulkUpdate(db, "symbol_call", callUpdates);

  const edgeCount = new Set(importUpdates.filter((u) => u.target && u.target !== u.fileId).map((u) => `${u.fileId}>${u.target}`)).size;
  await db
    .update(repository)
    .set({ status: "ready", symbolCount: symbols.length, edgeCount, lastIndexedAt: new Date(), error: null })
    .where(eq(repository.id, repoId));
}

async function embedBatch(db: Db, repoId: string) {
  const chunks = await db
    .select({ id: codeChunk.id, content: codeChunk.content, path: repoFile.path })
    .from(codeChunk)
    .innerJoin(repoFile, eq(repoFile.id, codeChunk.fileId))
    .where(and(eq(codeChunk.repositoryId, repoId), isNull(codeChunk.embedding)))
    .limit(EMBED_BATCH);
  if (chunks.length === 0) return 0;
  const vectors = await embedTexts(chunks.map((c) => `${c.path}\n${c.content}`), "document");
  await db.transaction(async (tx) => {
    for (let i = 0; i < chunks.length; i++) {
      await tx.update(codeChunk).set({ embedding: vectors[i] }).where(eq(codeChunk.id, chunks[i].id));
    }
  });
  return chunks.length;
}

export type JobView = typeof indexingJob.$inferSelect;

/**
 * Advances an indexing job for up to `budgetMs`. Safe to call concurrently and repeatedly:
 * a database lease ensures only one worker processes a job at a time.
 */
export async function runJobStep(jobId: string, ownerId: string, budgetMs = 20_000): Promise<{ job: JobView; worked: boolean }> {
  const db = await getDb();
  const started = Date.now();
  if (!(await acquireLease(db, jobId, ownerId))) {
    const [job] = await db.select().from(indexingJob).where(eq(indexingJob.id, jobId));
    return { job, worked: false };
  }

  let [job] = await db.select().from(indexingJob).where(eq(indexingJob.id, jobId));
  try {
    while (Date.now() - started < budgetMs) {
      [job] = await db.select().from(indexingJob).where(eq(indexingJob.id, jobId));
      if (job.cancelRequested) {
        await db.update(indexingJob).set({ status: "cancelled", finishedAt: new Date(), leaseUntil: null }).where(eq(indexingJob.id, jobId));
        await db.update(repository).set({ status: "cancelled", error: "Indexing was cancelled" }).where(eq(repository.id, job.repositoryId));
        break;
      }
      if (job.phase === "parse") {
        const n = await parseBatch(db, job.repositoryId);
        if (n === 0) {
          await db.update(indexingJob).set({ phase: "link" }).where(eq(indexingJob.id, jobId));
          await db.update(repository).set({ status: "linking" }).where(eq(repository.id, job.repositoryId));
        } else {
          await db.update(indexingJob).set({ processed: sql`${indexingJob.processed} + ${n}`, attempts: 0 }).where(eq(indexingJob.id, jobId));
        }
      } else if (job.phase === "link") {
        await link(db, job.repositoryId);
        const embed = embeddingsEnabled();
        await db
          .update(indexingJob)
          .set(embed ? { phase: "embed", processed: 0, total: 0 } : { phase: "done", status: "succeeded", finishedAt: new Date(), leaseUntil: null })
          .where(eq(indexingJob.id, jobId));
        if (!embed) break;
      } else if (job.phase === "embed") {
        const n = await embedBatch(db, job.repositoryId);
        if (n === 0) {
          await db.update(indexingJob).set({ phase: "done", status: "succeeded", finishedAt: new Date(), leaseUntil: null }).where(eq(indexingJob.id, jobId));
          break;
        }
        await db.update(indexingJob).set({ processed: sql`${indexingJob.processed} + ${n}` }).where(eq(indexingJob.id, jobId));
      } else {
        break;
      }
    }
  } catch (error) {
    const attempts = job.attempts + 1;
    const message = (error as Error).message.slice(0, 300);
    log("error", "indexing.step_failed", { jobId, phase: job.phase, attempts, error });
    if (job.phase === "embed") {
      // The repository is already searchable lexically; record the embedding failure without failing it.
      await db.update(indexingJob).set({ status: "succeeded", phase: "done", error: `Embeddings skipped: ${message}`, finishedAt: new Date(), leaseUntil: null }).where(eq(indexingJob.id, jobId));
    } else if (attempts >= MAX_ATTEMPTS) {
      await db.update(indexingJob).set({ status: "failed", error: message, attempts, finishedAt: new Date(), leaseUntil: null }).where(eq(indexingJob.id, jobId));
      await db.update(repository).set({ status: "failed", error: `Indexing failed: ${message}` }).where(eq(repository.id, job.repositoryId));
    } else {
      await db.update(indexingJob).set({ attempts, error: message, leaseUntil: null }).where(eq(indexingJob.id, jobId));
    }
  } finally {
    await db.update(indexingJob).set({ leaseUntil: null }).where(and(eq(indexingJob.id, jobId), eq(indexingJob.status, "running")));
  }
  const [final] = await db.select().from(indexingJob).where(eq(indexingJob.id, jobId));
  return { job: final, worked: true };
}

/** Runs a job to completion (used in tests and by the background `after()` worker). */
export async function runJobToCompletion(jobId: string, ownerId: string, maxMs = 240_000) {
  const start = Date.now();
  let last: JobView | undefined;
  while (Date.now() - start < maxMs) {
    const { job, worked } = await runJobStep(jobId, ownerId, 20_000);
    last = job;
    if (["succeeded", "failed", "cancelled"].includes(job.status)) break;
    if (!worked) await new Promise((r) => setTimeout(r, 1000));
  }
  return last;
}
