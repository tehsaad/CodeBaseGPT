import { defineConfig, devices } from "@playwright/test";

const PORT = 3210;
const dataDir = `.data/e2e-${Date.now()}`;

export default defineConfig({
  testDir: "tests/e2e",
  timeout: 120_000,
  expect: { timeout: 30_000 },
  fullyParallel: false,
  workers: 1,
  reporter: [["list"]],
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testIgnore: /(mobile|provider|a11y)\.spec\.ts/ },
    { name: "a11y", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } }, testMatch: /a11y\.spec\.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"] }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: process.env.E2E_PROD ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    timeout: 180_000,
    reuseExistingServer: false,
    // Fresh embedded database per run; no AI/search credentials so honest "not configured" states are exercised.
    env: { CBG_DATA_DIR: dataDir, CBG_ALLOW_EMBEDDED_DB: "1", BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdefghijklmnop", BETTER_AUTH_URL: `http://localhost:${PORT}`, GEMMA_API_KEY: "", GEMMA_MODEL: "", TAVILY_API_KEY: "", EXA_API_KEY: "" },
  },
});
