import { test, expect } from "@playwright/test";
import { promises as fs } from "node:fs";

test("create and play an animation", async ({ page }) => {
  const repoDir = (await fs.readFile(".data/e2e-repo-path", "utf8")).trim();

  await page.goto("/create");
  await page.getByLabel(/repository/i).fill(repoDir);
  await page.getByLabel(/file path/i).fill("demo.txt");
  await page.getByRole("button", { name: /animate/i }).click();

  await page.waitForURL(/\/a\/.+/, { timeout: 60000 });
  await expect(page.getByText("1 / 2")).toBeVisible();

  await page.getByRole("button", { name: /play/i }).click();
  await expect(page.getByText("2 / 2")).toBeVisible({ timeout: 10000 });
});
