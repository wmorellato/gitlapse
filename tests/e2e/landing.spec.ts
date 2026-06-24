import { test, expect } from "@playwright/test";

test("landing page shows the CTA and links to create", async ({ page }) => {
  await page.goto("/");
  // Headline is present (no redirect away from root).
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  // CTA navigates to the create flow.
  await page.getByRole("link", { name: /animate a file/i }).click();
  await page.waitForURL(/\/create$/);
  await expect(page.getByRole("button", { name: /animate/i })).toBeVisible();
});
