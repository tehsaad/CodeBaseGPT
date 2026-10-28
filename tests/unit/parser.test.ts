import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { extract } from "@/lib/code-intelligence/parser";
import { FIXTURE_DIR } from "../helpers/fixture";

const read = (p: string) => readFileSync(path.join(FIXTURE_DIR, p), "utf8");

describe("tree-sitter extraction", () => {
  it("TypeScript: functions, types, imports and exact line ranges", async () => {
    const src = read("src/auth/session.ts");
    const r = await extract(src, "typescript");
    const byName = Object.fromEntries(r.symbols.map((s) => [s.name, s]));
    expect(Object.keys(byName)).toEqual(expect.arrayContaining(["Session", "signSession", "readSession", "signIn"]));
    expect(byName.Session.kind).toBe("type");
    expect(byName.signIn).toMatchObject({ kind: "function", exported: true });
    const lines = src.split("\n");
    expect(lines[byName.readSession.startLine - 1]).toContain("export function readSession");
    expect(lines[byName.readSession.endLine - 1].trim()).toBe("}");
    expect(r.imports.map((i) => i.specifier)).toEqual(["node:crypto", "@/lib/db", "./password"]);
    expect(r.imports[1].names).toEqual(["findUserByEmail", "User"]);
    const call = r.calls.find((c) => c.calleeName === "verifyPassword");
    expect(call && r.symbols[call.callerIndex!].name).toBe("signIn");
    expect(byName.readSession.complexity).toBeGreaterThan(byName.signSession.complexity);
  });

  it("JavaScript: CommonJS require, classes and methods", async () => {
    const r = await extract(read("src/api/tasks.js"), "javascript");
    expect(r.imports).toEqual([{ specifier: "../auth/session", names: [], line: 1, kind: "module" }]);
    expect(r.symbols.map((s) => `${s.kind}:${s.parentName ?? ""}.${s.name}`)).toEqual([
      "class:.TaskController",
      "method:TaskController.constructor",
      "method:TaskController.list",
    ]);
  });

  it("Python: relative imports, classes, methods", async () => {
    const r = await extract(read("py/app/service.py"), "python");
    expect(r.imports.map((i) => [i.specifier, i.names])).toEqual([["json", []], [".models", ["Task"]]]);
    expect(r.symbols.map((s) => s.name)).toEqual(["load_tasks", "summarize"]);
    const m = await extract(read("py/app/models.py"), "python");
    expect(m.symbols.map((s) => `${s.kind}:${s.name}`)).toEqual(["class:Task", "method:__init__", "method:complete"]);
  });

  it("Java: package, imports, class, constructor, methods", async () => {
    const r = await extract(read("java/src/main/java/com/demo/TaskService.java"), "java");
    expect(r.javaPackage).toBe("com.demo");
    expect(r.imports.map((i) => i.specifier)).toEqual(["java.util.List", "com.demo.TaskRepository"]);
    expect(r.symbols.map((s) => `${s.kind}:${s.name}`)).toEqual(["class:TaskService", "method:TaskService", "method:countOpen"]);
    expect(r.calls.map((c) => c.calleeName)).toEqual(expect.arrayContaining(["findOpen", "size"]));
  });

  it("C and C++: includes, functions, structs, qualified methods", async () => {
    const c = await extract(read("native/src/queue.c"), "c");
    expect(c.imports).toEqual([
      { specifier: "queue.h", names: [], line: 1, kind: "include-local" },
      { specifier: "stdlib.h", names: [], line: 2, kind: "include-system" },
    ]);
    expect(c.symbols[0]).toMatchObject({ name: "queue_push", kind: "function", startLine: 4, endLine: 10 });
    const cpp = await extract(read("native/src/worker.cpp"), "cpp");
    expect(cpp.symbols.map((s) => `${s.kind}:${s.parentName ?? ""}.${s.name}`)).toEqual(
      expect.arrayContaining(["namespace:.jobs", "class:.Worker", "method:jobs::Worker.run"]),
    );
    expect(cpp.calls.find((x) => x.calleeName === "queue_push")).toBeTruthy();
  });

  it("does not throw on malformed input and reports syntax errors", async () => {
    const r = await extract("export function broken( {\n  return ;;; }}}", "typescript");
    expect(r.hasErrors).toBe(true);
  });
});
