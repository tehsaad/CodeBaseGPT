import { describe, expect, it } from "vitest";
import { classifyPath, compileGitignore, normalizeEntryPath, sanitizeContent } from "@/lib/code-intelligence/filter";
import { parseGitHubInput } from "@/lib/ingest/github";
import { safeExternalUrl } from "@/lib/search/url";
import { normalizeResults } from "@/lib/search/provider";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

describe("GitHub input parsing (SSRF guard)", () => {
  it.each([
    ["vercel/next.js", { owner: "vercel", repo: "next.js", ref: null }],
    ["https://github.com/vercel/next.js", { owner: "vercel", repo: "next.js", ref: null }],
    ["https://github.com/vercel/next.js.git", { owner: "vercel", repo: "next.js", ref: null }],
    ["github.com/a/b/tree/feature/x", { owner: "a", repo: "b", ref: "feature/x" }],
    ["owner/repo@v1.2.3", { owner: "owner", repo: "repo", ref: "v1.2.3" }],
  ])("accepts %s", (input, expected) => expect(parseGitHubInput(input)).toEqual(expected));

  it.each([
    "https://gitlab.com/a/b", "https://github.com.evil.com/a/b", "https://user:pw@github.com/a/b", "https://github.com:8080/a/b",
    "ftp://github.com/a/b", "javascript:alert(1)", "http://127.0.0.1/a/b", "a", "a/b/c/d", "-bad/repo", "a/..", "owner/repo@../../etc",
  ])("rejects %s", (input) => expect(parseGitHubInput(input)).toBeNull());
});

describe("file filtering", () => {
  it.each([
    ["node_modules/x/index.js", "ignored-directory"], [".env", "secret"], [".env.production", "secret"], ["keys/server.pem", "secret"],
    ["id_rsa", "secret"], ["config/credentials.json", "secret"], [".npmrc", "secret"], ["package-lock.json", "lockfile"],
    ["img/logo.png", "binary"], ["dist/app.min.js", "ignored-directory"], ["static/app.min.js", "generated"], ["a/b.unknownext", "unknown-type"],
  ])("%s -> %s", (p, reason) => expect(classifyPath(p)).toBe(reason));

  it("keeps normal source files", () => {
    for (const p of ["src/index.ts", "app/main.py", "bin/cli.js", "include/a.h", "README.md"]) expect(classifyPath(p)).toBeNull();
  });

  it("honors .gitignore patterns including negation and anchors", () => {
    const ig = compileGitignore("# c\n*.log\n/build\ncache/\n!keep.log\nsrc/**/gen\n");
    expect(ig("a/debug.log")).toBe(true);
    expect(ig("keep.log")).toBe(false);
    expect(ig("build/x.js")).toBe(true);
    expect(ig("src/build/x.js")).toBe(false);
    expect(ig("x/cache/y")).toBe(true);
    expect(ig("src/a/b/gen/f.ts")).toBe(true);
  });

  it("drops private keys and redacts known token formats", () => {
    expect(sanitizeContent("-----BEGIN OPENSSH PRIVATE KEY-----\nabc")).toBeNull();
    const r = sanitizeContent('const a = "AKIAABCDEFGHIJKLMNOP"; const b = "sk-proj-abcdefghijklmnopqrstuvwxyz";')!;
    expect(r.redactions).toBe(2);
    expect(r.content).not.toMatch(/AKIA|sk-proj/);
  });

  it("rejects unsafe archive entry names", () => {
    for (const n of ["../x", "a/../../x", "/etc/passwd", "C:/x", "a\\b", "a\u0000b"]) expect(normalizeEntryPath(n)).toBeNull();
    expect(normalizeEntryPath("./a//b/c.ts")).toBe("a/b/c.ts");
  });
});

describe("external URL safety", () => {
  it("allows public http(s) only", () => {
    expect(safeExternalUrl("https://docs.python.org/3/")?.hostname).toBe("docs.python.org");
    for (const u of ["javascript:alert(1)", "data:text/html,x", "http://localhost:3000", "http://10.0.0.5/x", "http://169.254.169.254/", "https://u:p@example.com", "notaurl", 42]) {
      expect(safeExternalUrl(u)).toBeNull();
    }
  });

  it("normalizes provider results: drops unsafe/duplicate URLs, strips markup, boosts official docs", () => {
    const out = normalizeResults([
      { title: "<b>Blog</b>", url: "https://random.blog/post", snippet: "<script>x</script>hello", score: 0.6 },
      { title: "MDN", url: "https://developer.mozilla.org/a", snippet: "docs", score: 0.5 },
      { title: "dup", url: "https://developer.mozilla.org/a#frag", snippet: "docs", score: 0.4 },
      { title: "x", url: "javascript:void(0)" },
    ]);
    expect(out.map((r) => r.domain)).toEqual(["developer.mozilla.org", "random.blog"]);
    expect(out[1].title).toBe("Blog");
    expect(out[1].snippet).toBe("xhello");
  });
});

describe("password hashing", () => {
  it("uses Argon2id and verifies correctly", async () => {
    const h = await hashPassword("correct-horse-battery");
    expect(h.startsWith("$argon2id$")).toBe(true);
    expect(await verifyPassword({ hash: h, password: "correct-horse-battery" })).toBe(true);
    expect(await verifyPassword({ hash: h, password: "wrong" })).toBe(false);
    expect(await verifyPassword({ hash: "garbage", password: "x" })).toBe(false);
  });
});
