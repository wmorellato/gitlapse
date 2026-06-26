import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";

test("single input: paste an absolute file path", async ({ page }) => {
  const repoDir = (await fs.readFile(".data/e2e-repo-path", "utf8")).trim();

  await page.goto("/create");
  await page.getByLabel(/file url/i).fill(`${repoDir}/demo.txt`);
  await page.getByRole("button", { name: /animate/i }).click();

  await page.waitForURL(/\/a\/.+/, { timeout: 60000 });
  await expect(page.getByText("1 / 2")).toBeVisible();
});
