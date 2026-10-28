import { defineConfig, devices } from "@playwright/test";

// Runs the app against a local OpenAI-compatible TEST DOUBLE (tests/e2e/mock-openai-server.mjs)
// to exercise the real streaming, citation and persistence path end to end without credentials.
const PORT = 3220;
const LLM = 3299;

export default defineConfig({
  testDir: "tests/e2e",
  testMatch: /provider\.spec\.ts/,
  timeout: 120_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: [["list"]],
  use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 }, baseURL: `http://localhost:${PORT}` },
  webServer: [
    { command: `node tests/e2e/mock-openai-server.mjs`, url: `http://127.0.0.1:${LLM}/health`, env: { MOCK_LLM_PORT: String(LLM) }, reuseExistingServer: false },
    {
      command: process.env.E2E_PROD ? `npx next start -p ${PORT}` : `npx next dev -p ${PORT}`,
      url: `http://localhost:${PORT}`,
      timeout: 180_000,
      reuseExistingServer: false,
      env: {
        CBG_DATA_DIR: `.data/e2e-provider-${Date.now()}`,
        CBG_ALLOW_EMBEDDED_DB: "1",
        BETTER_AUTH_SECRET: "e2e-only-secret-0123456789abcdefghijklmnop",
        BETTER_AUTH_URL: `http://localhost:${PORT}`,
        GEMMA_PROVIDER: "openai-compatible",
        GEMMA_BASE_URL: `http://127.0.0.1:${LLM}/v1`,
        GEMMA_MODEL: "mock-gemma",
        TAVILY_API_KEY: "",
        EXA_API_KEY: "",
      },
    },
  ],
});
