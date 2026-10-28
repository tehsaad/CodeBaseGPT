import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { strToU8, zipSync } from "fflate";
import * as reposRoute from "@/app/api/repos/route";
import * as graphRoute from "@/app/api/repos/[id]/graph/route";
import * as filesRoute from "@/app/api/repos/[id]/files/route";
import * as symbolRoute from "@/app/api/repos/[id]/symbols/[symbolId]/route";
import * as searchRoute from "@/app/api/repos/[id]/search/route";
import * as impactRoute from "@/app/api/repos/[id]/impact/route";
import { closeDb, getDb } from "@/lib/db";
import { runJobToCompletion } from "@/lib/ingest/indexer";
import { call, signUp } from "../helpers/app";
import { fixtureFiles } from "../helpers/fixture";

let alice = "";
let bob = "";
let repoId = "";
const ids: Record<string, string> = {};

beforeAll(async () => {
  await getDb();
  alice = await signUp(`atlas-a-${Date.now()}@example.com`);
  bob = await signUp(`atlas-b-${Date.now()}@example.com`);
  const files = fixtureFiles();
  // Extra files for impact analysis: a test that imports the API (transitively reaching session.ts)
  // and a name-only match that doesn't import anything.
  files["src/api/login.test.ts"] = strToU8('import { handleLogin } from "./login";\ntest("rejects empty", async () => { await handleLogin({}); });\n');
  files["tests/session_notes.test.ts"] = strToU8("// mentions session but imports nothing\n");
  const zip = zipSync(Object.fromEntries(Object.entries(files).map(([p, c]) => [`repo/${p}`, c])));
  const form = new FormData();
  form.append("file", new File([zip as BlobPart], "impact.zip", { type: "application/zip" }));
  const body = await (await call(reposRoute.POST, "", { cookie: alice, form })).json();
  repoId = body.repository.id;
  await runJobToCompletion(body.job.id, body.repository.ownerId, 60_000);
  const { files: list } = await (await call(filesRoute.GET, "", { cookie: alice, params: { id: repoId } })).json();
  for (const f of list) ids[f.path] = f.id;
});
afterAll(() => closeDb());

describe("Atlas data", () => {
  it("returns every repository folder for the folder filter, not just expanded ones", async () => {
    const g = await (await call(graphRoute.GET, "/x?mode=dependencies", { cookie: alice, params: { id: repoId } })).json();
    const folders = g.folders.map((f: { path: string }) => f.path);
    expect(folders).toEqual(expect.arrayContaining(["src", "src/auth", "py/app", "java/src/main/java/com/demo", "native/include"]));
    expect(g.folders.find((f: { path: string }) => f.path === "src/auth").files).toBe(2);
    expect(g.limitReason).toBeUndefined();
  });

  it("explains call relationships with call-site lines and how they were derived", async () => {
    const { results } = await (await call(searchRoute.GET, "/x?q=signIn", { cookie: alice, params: { id: repoId } })).json();
    const signIn = results.find((r: { type: string; name: string }) => r.type === "symbol" && r.name === "signIn");
    const rel = await (await call(symbolRoute.GET, "", { cookie: alice, params: { id: repoId, symbolId: signIn.id } })).json();
    const byName = Object.fromEntries(rel.calls.map((c: { name: string }) => [c.name, c]));
    expect(byName.signSession).toMatchObject({ derivation: "same-file", line: 28 });
    expect(byName.verifyPassword).toMatchObject({ derivation: "via-import", target: { path: "src/auth/password.ts" } });
    expect(byName.now ?? byName.Date ?? { derivation: "unresolved" }).toMatchObject({ derivation: "unresolved" });
    expect(rel.calledBy).toEqual([expect.objectContaining({ path: "src/api/login.ts", derivation: "via-import", caller: expect.objectContaining({ name: "handleLogin" }) })]);
  });
});

describe("Change impact", () => {
  it("finds direct and transitive dependents with dependency paths, and labels tests by evidence", async () => {
    const res = await call(impactRoute.GET, `/x?file=${ids["src/auth/password.ts"]}`, { cookie: alice, params: { id: repoId } });
    const imp = await res.json();
    expect(imp.directDependents.map((d: { path: string }) => d.path)).toEqual(["src/auth/session.ts"]);
    expect(imp.transitiveDependents.map((d: { path: string }) => d.path)).toEqual(expect.arrayContaining(["src/api/login.ts", "src/api/tasks.js", "src/api/login.test.ts"]));
    const test = imp.tests.find((t: { path: string }) => t.path === "src/api/login.test.ts");
    expect(test.evidence).toBe("extracted");
    expect(test.chain.map((c: { path: string }) => c.path)).toEqual(["src/api/login.test.ts", "src/api/login.ts", "src/auth/session.ts", "src/auth/password.ts"]);
    expect(test.chain[0].line).toBe(1);
    expect(imp.steps[0]).toMatch(/Run the 1 test file/);
    expect(imp.completeness.note).toMatch(/not traced/);
  });

  it("marks name-only test matches as inferred and symbol call sites as extracted", async () => {
    const imp = await (await call(impactRoute.GET, `/x?file=${ids["src/auth/session.ts"]}`, { cookie: alice, params: { id: repoId } })).json();
    expect(imp.tests.find((t: { path: string }) => t.path === "tests/session_notes.test.ts")?.evidence).toBe("inferred");
    const { results } = await (await call(searchRoute.GET, "/x?q=verifyPassword", { cookie: alice, params: { id: repoId } })).json();
    const sym = results.find((r: { type: string }) => r.type === "symbol");
    const s = await (await call(impactRoute.GET, `/x?symbol=${sym.id}`, { cookie: alice, params: { id: repoId } })).json();
    expect(s.target.symbol.name).toBe("verifyPassword");
    expect(s.calls.callers).toEqual([expect.objectContaining({ path: "src/auth/session.ts", caller: "signIn" })]);
  });

  it("is private to the repository owner and validates input", async () => {
    expect((await call(impactRoute.GET, `/x?file=${ids["src/auth/password.ts"]}`, { cookie: bob, params: { id: repoId } })).status).toBe(404);
    expect((await call(impactRoute.GET, "/x", { cookie: alice, params: { id: repoId } })).status).toBe(400);
    expect((await call(impactRoute.GET, `/x?file=00000000-0000-4000-8000-000000000000`, { cookie: alice, params: { id: repoId } })).status).toBe(404);
  });
});
