import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq, isNull, sql } from "drizzle-orm";
import * as reposRoute from "@/app/api/repos/route";
import { setEmbeddingOverrideForTests } from "@/lib/ai/embeddings";
import { retrieve } from "@/lib/ai/retrieval";
import { closeDb, getDb, schema } from "@/lib/db";
import { EMBEDDING_DIMENSIONS } from "@/lib/db/schema";
import { runJobToCompletion } from "@/lib/ingest/indexer";
import { call, signUp } from "../helpers/app";
import { fixtureZip } from "../helpers/fixture";

/** Deterministic bag-of-words hashing embedder (test double for a real embedding model). */
function fakeEmbed(values: string[]) {
  return Promise.resolve(
    values.map((v) => {
      const vec = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      for (const w of v.toLowerCase().match(/[a-z]{3,}/g) ?? []) {
        let h = 0;
        for (const ch of w) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
        vec[h % EMBEDDING_DIMENSIONS] += 1;
      }
      const norm = Math.hypot(...vec) || 1;
      return vec.map((x) => x / norm);
    }),
  );
}

let repoId = "";

describe("semantic retrieval (pgvector)", () => {
  beforeAll(async () => {
    setEmbeddingOverrideForTests(fakeEmbed);
    await getDb();
    const cookie = await signUp(`emb-${Date.now()}@example.com`);
    const form = new FormData();
    form.append("file", new File([fixtureZip() as BlobPart], "emb.zip", { type: "application/zip" }));
    const body = await (await call(reposRoute.POST, "/api/repos", { cookie, form })).json();
    repoId = body.repository.id;
    const job = await runJobToCompletion(body.job.id, body.repository.ownerId, 60_000);
    expect(job?.status).toBe("succeeded");
    expect(job?.phase).toBe("done");
  });
  afterAll(async () => {
    setEmbeddingOverrideForTests(null);
    await closeDb();
  });

  it("embeds every chunk during indexing", async () => {
    const db = await getDb();
    const missing = await db.select({ n: sql<number>`count(*)::int` }).from(schema.codeChunk).where(and(eq(schema.codeChunk.repositoryId, repoId), isNull(schema.codeChunk.embedding)));
    expect(missing[0].n).toBe(0);
  });

  it("finds code by vector similarity even without lexical overlap in the question", async () => {
    // "scrypt timingsafeequal derived" only appears in password.ts; the stopword-heavy phrasing keeps lexical weak.
    const ev = await retrieve({ repoId, question: "which part compares derived scrypt hashes with timingSafeEqual" });
    expect(ev.some((e) => e.path === "src/auth/password.ts")).toBe(true);
    // No lexical match at all: anything returned must come from the vector index.
    const sem = await retrieve({ repoId, question: "zzqx" });
    expect(sem.length).toBeGreaterThan(0);
    expect(sem.every((e) => e.reason === "semantic")).toBe(true);
  });
});
