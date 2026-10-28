import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { fixtureZip } from "../helpers/fixture";

test.describe.configure({ mode: "serial" });

let repoPath = "";

async function scan(page: Page, label: string) {
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa"]).exclude(".react-flow__minimap").analyze();
  const summary = results.violations.map((v) => `${label}: ${v.id} (${v.impact}) ×${v.nodes.length} — ${v.nodes[0]?.target.join(" ")} — ${v.nodes[0]?.failureSummary?.split("\n")[1]?.trim() ?? ""}`);
  return summary;
}

test("WCAG 2.1 AA scan across key pages in both themes, plus tablet screenshots", async ({ page }) => {
  test.setTimeout(240_000);
  const problems: string[] = [];
  for (const path of ["/", "/sign-in", "/sign-up"]) {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    problems.push(...(await scan(page, `dark ${path}`)));
  }
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("A11y");
  await page.getByLabel("Email").fill(`a11y-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByLabel("Confirm password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.goto("/repos");
  await page.getByRole("tab", { name: "ZIP upload" }).click();
  await page.getByLabel("ZIP archive").setInputFiles({ name: "taskboard.zip", mimeType: "application/zip", buffer: Buffer.from(fixtureZip()) });
  await page.getByRole("button", { name: "Import and index" }).click();
  await expect(page.getByText("Indexed", { exact: true }).first()).toBeVisible({ timeout: 90_000 });
  repoPath = new URL(page.url()).pathname;

  const pages = ["/dashboard", "/repos", repoPath, `${repoPath}/atlas?expanded=src,src/auth&node=file:src/auth/session.ts`, `${repoPath}/ask`, `${repoPath}/stuck`, `${repoPath}/insights`, `${repoPath}/source`, `${repoPath}/guide`, `${repoPath}/impact`, `${repoPath}/learn`, `${repoPath}/notes`, "/saved", "/history", "/settings", "/tutor"];
  for (const theme of ["dark", "light"] as const) {
    await page.evaluate((t) => localStorage.setItem("cbg-theme", t), theme);
    for (const path of pages) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(400);
      problems.push(...(await scan(page, `${theme} ${path.replace(repoPath, "/repos/:id")}`)));
    }
  }
  // Visual review artefacts (not asserted): tablet/laptop breakpoints and light theme.
  for (const [w, h, theme] of [[768, 1024, "dark"], [1024, 768, "dark"], [1440, 900, "light"]] as const) {
    await page.setViewportSize({ width: w, height: h });
    await page.evaluate((t) => localStorage.setItem("cbg-theme", t), theme);
    for (const [name, path] of [["atlas", `${repoPath}/atlas?expanded=src,src/auth&node=file:src/auth/session.ts`], ["dashboard", "/dashboard"], ["landing", "/"]] as const) {
      await page.goto(path);
      await page.waitForLoadState("networkidle");
      await page.waitForTimeout(600);
      await page.screenshot({ path: `.data/shots/${name}-${w}-${theme}.png` });
    }
  }
  console.log(problems.join("\n") || "no violations");
  expect(problems).toEqual([]);
});
