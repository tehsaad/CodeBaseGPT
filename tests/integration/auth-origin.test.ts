import { afterAll, beforeAll, describe, expect, it } from "vitest";
import * as authRoute from "@/app/api/auth/[...all]/route";
import { resetAuthForTests } from "@/lib/auth";
import { closeDb, getDb } from "@/lib/db";
import { resetEnvForTests } from "@/lib/env";

const BASE = "http://localhost:3000";

function signUp(origin: string) {
  return authRoute.POST(
    new Request(`${BASE}/api/auth/sign-up/email`, {
      method: "POST",
      headers: { "content-type": "application/json", origin, cookie: "x=1" },
      body: JSON.stringify({ email: `o-${Math.random()}@example.com`, password: "correct-horse-battery", name: "o" }),
    }),
  );
}

describe("auth origin checks (CSRF)", () => {
  beforeAll(async () => {
    process.env.BETTER_AUTH_URL = BASE;
    process.env.VERCEL_BRANCH_URL = "codebasegpt-git-feature-me.vercel.app";
    resetEnvForTests();
    resetAuthForTests();
    await getDb();
  });
  afterAll(async () => {
    delete process.env.BETTER_AUTH_URL;
    delete process.env.VERCEL_BRANCH_URL;
    resetEnvForTests();
    resetAuthForTests();
    await closeDb();
  });

  it("rejects a cross-site origin", async () => {
    expect((await signUp("https://evil.example")).status).toBe(403);
  });

  it("accepts the configured origin and the Vercel branch deployment origin", async () => {
    expect((await signUp(BASE)).status).toBe(200);
    expect((await signUp("https://codebasegpt-git-feature-me.vercel.app")).status).toBe(200);
  });
});
