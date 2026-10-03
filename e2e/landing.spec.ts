import { expect, test } from "@playwright/test";

test("the landing page presents Koyomi, the tracker and its LINE reminders", async ({ page }) => {
  await page.goto("/");

  await expect(page).toHaveTitle("Koyomi");
  await expect(page.getByRole("banner").getByRole("link", { name: "Koyomi" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Thai time");
  await expect(page.getByRole("main")).toContainText("LINE");
});

test("the landing page leads a visitor to create an account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Create account" }).click();

  await expect(page).toHaveURL(/\/sign-up$/);
  await expect(page).toHaveTitle("Create account · Koyomi");
});
