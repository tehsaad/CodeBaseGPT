import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import * as reposRoute from "@/app/api/repos/route";
import * as filesRoute from "@/app/api/repos/[id]/files/route";
import * as guideRoute from "@/app/api/repos/[id]/guide/route";
import * as learningRoute from "@/app/api/repos/[id]/learning/route";
import * as notesRoute from "@/app/api/repos/[id]/notes/route";
import * as noteRoute from "@/app/api/repos/[id]/notes/[noteId]/route";
import { closeDb, getDb, schema } from "@/lib/db";
import { runJobToCompletion } from "@/lib/ingest/indexer";
import { eq } from "drizzle-orm";
import { call, clearGemma, mockGemma, readUIStream, signUp, streamedText } from "../helpers/app";
import { fixtureFiles } from "../helpers/fixture";

let alice = "";
let bob = "";
let repoId = "";
const ids: Record<string, string> = {};

beforeAll(async () => {
  await getDb();
  alice = await signUp(`guide-a-${Date.now()}@example.com`);
  bob = await signUp(`guide-b-${Date.now()}@example.com`);
  const files = fixtureFiles();
  files["README.md"] = strToU8("# Demo\n\nA small task tracker used for tests.\n");
  files["py/app/cli.py"] = strToU8('from app.service import TaskService\n\n\ndef run():\n    print(TaskService)\n\n\nif __name__ == "__main__":\n    run()\n');
  files["tools/hello.py"] = strToU8(Array.from({ length: 10 }, (_, i) => `print("line ${i}")`).join("\n") + "\n");
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([p, c]) => [`repo/${p}`, c])));
  const form = new FormData();
  form.append("file", new File([zip as BlobPart], "guide.zip", { type: "application/zip" }));
  const body = await (await call(reposRoute.POST, "", { cookie: alice, form })).json();
  repoId = body.repository.id;
  await runJobToCompletion(body.job.id, body.repository.ownerId, 60_000);
  const { files: list } = await (await call(filesRoute.GET, "", { cookie: alice, params: { id: repoId } })).json();
  for (const f of list) ids[f.path] = f.id;
});
afterAll(async () => {
  clearGemma();
  await closeDb();
});

describe("Codebase guide", () => {
  it("returns deterministic facts with real entry points and hubs before any AI runs", async () => {
    const res = await call(guideRoute.GET, "", { cookie: alice, params: { id: repoId } });
    const { facts, guide } = await res.json();
    expect(guide).toBeNull();
    expect(facts.readme.path).toBe("README.md");
    expect(facts.hubs[0]).toMatchObject({ path: expect.any(String), importers: expect.any(Number) });
    expect(facts.hubs.map((h: { path: string }) => h.path)).toContain("src/auth/session.ts");
    expect(facts.entries).toContainEqual(expect.objectContaining({ path: "py/app/cli.py", line: 8, why: "defines a program main" }));
    for (const e of facts.entries) expect(ids[e.path]).toBe(e.fileId);
  });

  it("streams a cited guide, rejects invented labels, and caches it", async () => {
    mockGemma("## What this project does\nA task tracker [C1]. Sessions are signed in session.ts [C2]. Also [C99].");
    const chunks = await readUIStream(await call(guideRoute.POST, "", { cookie: alice, method: "POST", params: { id: repoId } }));
    const evidence = chunks.find((c) => c.type === "data-evidence")!.data.items;
    expect(evidence[0].path).toBe("README.md");
    expect(streamedText(chunks)).toContain("[C2]");
    expect(chunks.find((c) => c.type === "data-citations")!.data).toEqual({ used: ["C1", "C2"], invalid: ["C99"] });
    const { guide } = await (await call(guideRoute.GET, "", { cookie: alice, params: { id: repoId } })).json();
    expect(guide).toMatchObject({ kind: "guide", usedLabels: ["C1", "C2"], stale: false, model: "gemma-test via mock", data: { invalidCitations: ["C99"] } });
  });

  it("marks the cached guide stale after a newer index", async () => {
    const db = await getDb();
    await db.update(schema.repository).set({ lastIndexedAt: new Date(Date.now() + 60_000) }).where(eq(schema.repository.id, repoId));
    const { guide } = await (await call(guideRoute.GET, "", { cookie: alice, params: { id: repoId } })).json();
    expect(guide.stale).toBe(true);
  });

  it("is private to the owner", async () => {
    expect((await call(guideRoute.GET, "", { cookie: bob, params: { id: repoId } })).status).toBe(404);
    expect((await call(guideRoute.POST, "", { cookie: bob, method: "POST", params: { id: repoId } })).status).toBe(404);
  });
});

describe("Learning path", () => {
  it("builds stages from real files and tracks private progress", async () => {
    const { stages, completed } = await (await call(learningRoute.GET, "", { cookie: alice, params: { id: repoId } })).json();
    expect(completed).toEqual([]);
    const tasks = stages.flatMap((s: { tasks: { id: string; fileId?: string; path?: string; kind: string }[] }) => s.tasks);
    expect(tasks[0]).toMatchObject({ id: "read:README.md", kind: "read" });
    for (const t of tasks) if (t.fileId) expect(ids[t.path!]).toBe(t.fileId);
    expect(tasks.some((t: { kind: string; path?: string }) => t.kind === "run" && t.path === "tools/hello.py")).toBe(true);

    expect((await call(learningRoute.POST, "", { cookie: alice, json: { taskId: "read:README.md", done: true }, params: { id: repoId } })).status).toBe(200);
    expect((await call(learningRoute.POST, "", { cookie: alice, json: { taskId: "read:invented.md", done: true }, params: { id: repoId } })).status).toBe(404);
    expect((await call(learningRoute.POST, "", { cookie: bob, json: { taskId: "read:README.md", done: true }, params: { id: repoId } })).status).toBe(404);
    const after = await (await call(learningRoute.GET, "", { cookie: alice, params: { id: repoId } })).json();
    expect(after.completed).toEqual(["read:README.md"]);
  });
});

describe("Repository notes", () => {
  it("creates anchored notes, flags them when the file changes, and isolates owners", async () => {
    const created = await call(notesRoute.POST, "", { cookie: alice, json: { kind: "decision", title: "Why HMAC sessions", body: "Stateless tokens.", fileId: ids["src/auth/session.ts"], startLine: 3 }, params: { id: repoId } });
    expect(created.status).toBe(201);
    const { note } = await created.json();
    let { notes } = await (await call(notesRoute.GET, "", { cookie: alice, params: { id: repoId } })).json();
    expect(notes[0]).toMatchObject({ id: note.id, path: "src/auth/session.ts", anchor: "current", startLine: 3, endLine: 3 });

    const db = await getDb();
    await db.update(schema.repoFile).set({ contentHash: "changed" }).where(eq(schema.repoFile.id, ids["src/auth/session.ts"]));
    ({ notes } = await (await call(notesRoute.GET, "", { cookie: alice, params: { id: repoId } })).json());
    expect(notes[0].anchor).toBe("changed");

    expect((await call(notesRoute.GET, "", { cookie: bob, params: { id: repoId } })).status).toBe(404);
    expect((await call(noteRoute.DELETE, "", { cookie: bob, method: "DELETE", params: { id: repoId, noteId: note.id } })).status).toBe(404);
    expect((await call(notesRoute.POST, "", { cookie: alice, json: { kind: "decision", title: "x", fileId: "00000000-0000-4000-8000-000000000000" }, params: { id: repoId } })).status).toBe(404);
    expect((await call(notesRoute.POST, "", { cookie: alice, json: { kind: "nope", title: "x" }, params: { id: repoId } })).status).toBe(400);

    const patched = await call(noteRoute.PATCH, "", { cookie: alice, method: "PATCH", json: { title: "Why stateless sessions" }, params: { id: repoId, noteId: note.id } });
    expect((await patched.json()).note.title).toBe("Why stateless sessions");
    expect((await call(noteRoute.DELETE, "", { cookie: alice, method: "DELETE", params: { id: repoId, noteId: note.id } })).status).toBe(200);
  });
});
