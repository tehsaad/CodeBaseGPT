import { expect, test, type Page } from "@playwright/test";
import { fixtureZip } from "../helpers/fixture";

test.describe.configure({ mode: "serial" });

const cspViolations: string[] = [];
test.beforeEach(({ page }) => {
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to (load|execute|apply)/i.test(m.text())) cspViolations.push(m.text());
  });
});
test.afterAll(() => expect(cspViolations).toEqual([]));

const email = `student-${Date.now()}@example.com`;
const password = "correct-horse-battery";
let repoUrl = "";

async function signIn(page: Page, who = email) {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(who);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test("landing page explains the product and links to sign-up", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Understand any codebase");
  await expect(page.getByText("Sample data")).toBeVisible();
  await expect(page.locator(".react-flow__node")).toHaveCount(7);
  await page.getByRole("link", { name: "Get started" }).first().click();
  await expect(page).toHaveURL(/\/sign-up/);
});

test("protected routes redirect to sign-in", async ({ page }) => {
  await page.goto("/repos");
  await expect(page).toHaveURL(/\/sign-in\?next=%2Frepos/);
});

test("registration validates input, then creates an account", async ({ page }) => {
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Test Student");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("short");
  await page.getByLabel("Confirm password").fill("short");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page.getByText("Use at least 10 characters")).toBeVisible();
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(page.getByText("Gemma answers")).toBeVisible();
  await expect(page.getByText(/Not configured — set GEMMA_MODEL/)).toBeVisible();
});

test("wrong password shows a generic error", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill("not-the-password");
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page.getByText("Email or password is incorrect.")).toBeVisible();
});

test("ZIP import indexes a repository and shows progress to completion", async ({ page }) => {
  await signIn(page);
  await page.goto("/repos");
  await page.getByRole("tab", { name: "ZIP upload" }).click();
  await page.getByLabel("ZIP archive").setInputFiles({ name: "taskboard.zip", mimeType: "application/zip", buffer: Buffer.from(fixtureZip()) });
  await page.getByRole("button", { name: "Import and index" }).click();
  await expect(page).toHaveURL(/\/repos\/[0-9a-f-]{36}$/);
  repoUrl = new URL(page.url()).pathname;
  await expect(page.getByText("Indexed", { exact: true }).first()).toBeVisible({ timeout: 90_000 });
  await expect(page.getByText("Files indexed")).toBeVisible();
});

test("Atlas renders real relationships; selecting a node opens its source", async ({ page }) => {
  await signIn(page);
  await page.goto(`${repoUrl}/atlas?expanded=src,src/auth,src/api,src/lib`);
  const session = page.locator(".react-flow__node", { hasText: "session.ts" });
  await expect(session).toBeVisible();
  await session.click();
  const panel = page.getByRole("complementary", { name: "Selected node details" });
  await expect(panel.getByText("src/auth/session.ts")).toBeVisible();
  await expect(panel.getByRole("button", { name: "src/auth/password.ts" })).toBeVisible();
  await expect(panel.getByRole("button", { name: "src/api/login.ts" })).toBeVisible();
  await panel.getByRole("button", { name: /signIn/ }).click();
  const drawer = page.getByRole("dialog");
  await expect(drawer.getByText("src/auth/session.ts:25–29")).toBeVisible();
  await expect(drawer.locator('.line.is-highlighted[data-line="25"]')).toContainText("export async function signIn");
  await page.keyboard.press("Escape");
  // Keyboard-accessible alternative lists the same nodes.
  await page.getByRole("button", { name: "Outline" }).click();
  await expect(page.getByRole("table")).toContainText("src/auth/session.ts");
  await page.goto(`${repoUrl}/insights`);
  await expect(page.getByText("Most depended-on files")).toBeVisible();
  await expect(page.getByRole("img", { name: /Language share/ })).toBeVisible();
});

test("Ask shows retrieved evidence with working citations and is honest when Gemma is unconfigured", async ({ page }) => {
  await signIn(page);
  await page.goto(`${repoUrl}/ask`);
  await expect(page.getByText("Gemma isn't configured on this server")).toBeVisible();
  await page.getByLabel("Your question").fill("How does signIn verify the password?");
  await page.getByRole("button", { name: "Send question" }).click();
  await expect(page.getByText("so no AI answer was generated")).toBeVisible();
  const chip = page.getByRole("button", { name: /Open citation C1: src\/auth\/session\.ts/ });
  await chip.click();
  await expect(page.getByRole("dialog").locator(".line.is-highlighted").first()).toBeVisible();
});

test("Stuck Mode finds related code from a stack trace and reports missing web search", async ({ page }) => {
  await signIn(page);
  await page.goto(`${repoUrl}/stuck`);
  await page.getByLabel("What are you trying to do, and what's going wrong?").fill("Login fails with a TypeError");
  await page.getByLabel("Error message or stack trace").fill("TypeError: Cannot read properties of undefined (reading 'split')\n    at verifyPassword (/home/me/src/auth/password.ts:4:25)");
  await page.getByRole("button", { name: "Find related code" }).click();
  await expect(page.getByText("src/auth/password.ts").first()).toBeVisible();
  await expect(page.getByLabel("Search query 1")).toHaveValue(/TypeError: Cannot read properties of undefined/);
  await page.getByRole("button", { name: "Explain the error" }).click();
  await expect(page.getByText("Web search isn't configured", { exact: true })).toBeVisible();
});

test("another user cannot open this repository", async ({ page }) => {
  const other = `other-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Other");
  await page.getByLabel("Email").fill(other);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByLabel("Confirm password").fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto(repoUrl);
  await expect(page.getByText("Repository not found")).toBeVisible();
  const res = await page.request.get(`/api${repoUrl}/graph?mode=architecture`);
  expect(res.status()).toBe(404);
});
