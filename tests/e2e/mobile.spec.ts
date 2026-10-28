import { expect, test } from "@playwright/test";

test("landing and auth pages fit a phone screen and the nav sheet works", async ({ page }) => {
  for (const path of ["/", "/sign-in", "/sign-up"]) {
    await page.goto(path);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, path).toBeLessThanOrEqual(0);
  }
  const email = `mobile-${Date.now()}@example.com`;
  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Mobile");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password", { exact: true }).fill("correct-horse-battery");
  await page.getByLabel("Confirm password").fill("correct-horse-battery");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await page.getByRole("button", { name: "Open navigation" }).click();
  const sheet = page.getByRole("dialog");
  await sheet.getByRole("link", { name: "Repositories" }).click();
  await expect(page).toHaveURL(/\/repos$/);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
