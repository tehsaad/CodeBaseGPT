import { expect, test } from "@playwright/test";
import { fixtureZip } from "../helpers/fixture";

// Uses the OpenAI-compatible provider TEST DOUBLE configured in playwright.provider.config.ts.
test("streamed Gemma answer survives the URL update, links valid citations and flags invented ones", async ({ page }) => {
  const cspViolations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(m.text())) cspViolations.push(m.text());
  });
  const email = `provider-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Provider Test");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByLabel("Confirm password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("mock-gemma (openai-compatible)")).toBeVisible();

  await page.goto("/repos");
  await page.getByRole("tab", { name: "ZIP upload" }).click();
  await page.getByLabel("ZIP archive").setInputFiles({ name: "taskboard.zip", mimeType: "application/zip", buffer: Buffer.from(fixtureZip()) });
  await page.getByRole("button", { name: "Import and index" }).click();
  await expect(page.getByText("Indexed", { exact: true }).first()).toBeVisible({ timeout: 90_000 });
  const repoPath = new URL(page.url()).pathname;

  await page.goto(`${repoPath}/ask`);
  await page.getByLabel("Your question").fill("How does signIn verify the password?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page).toHaveURL(/\?c=/);
  // Must still be streaming/complete in the same view after the ?c= update.
  await expect(page.getByText("a wrong password returns null")).toBeVisible();
  await expect(page.getByText(/AI answer · mock-gemma via 127\.0\.0\.1:3299/)).toBeVisible();
  await expect(page.getByTitle("This label wasn't in the supplied evidence, so it isn't linked")).toHaveText("C99");
  await expect(page.getByText(/referenced C99, which weren't in the evidence/)).toBeVisible();

  await page.getByRole("button", { name: /Open citation C1: src\/auth\/session\.ts/ }).click();
  await expect(page.getByRole("dialog").locator('.line.is-highlighted[data-line="25"]')).toContainText("signIn");
  await page.keyboard.press("Escape");

  await page.getByRole("button", { name: "Save" }).click();
  await expect(page.getByRole("button", { name: "Saved" })).toBeVisible();
  await page.goto("/saved");
  await expect(page.getByText("How does signIn verify the password?")).toBeVisible();

  // Reload restores the persisted conversation with working citations.
  await page.goto(`${repoPath}/ask`);
  await page.getByRole("link", { name: /How does signIn verify the password/ }).click();
  await expect(page.getByText("a wrong password returns null")).toBeVisible();
  await expect(page.getByRole("button", { name: /Open citation C1/ })).toBeVisible();

  // Stuck Mode explanation through the same provider, with search unavailable.
  await page.goto(`${repoPath}/stuck`);
  await page.getByLabel("What are you trying to do, and what's going wrong?").fill("Login fails with a TypeError");
  await page.getByLabel("Error message or stack trace").fill("TypeError: Cannot read properties of undefined (reading 'split')\n    at verifyPassword (/x/src/auth/password.ts:4:25)");
  await page.getByRole("button", { name: "Explain the error" }).click();
  await expect(page.getByText("a wrong password returns null")).toBeVisible();
  await expect(page.getByText("Web search isn't configured", { exact: true })).toBeVisible();
  await expect(page.getByText(/mock-gemma via 127\.0\.0\.1:3299 · verify before applying/)).toBeVisible();
  expect(cspViolations).toEqual([]);
});
