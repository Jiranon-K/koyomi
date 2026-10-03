import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { createVerifiedAccount } from "./account";
import { scanBothThemes } from "./axe";
import { clearSeededSyncs, makeAdmin, seedFailedSync } from "./seed";

const SCREENSHOTS = ".e2e/screenshots";
const SERVER_SECRET = "e2e-only-value-e2e-only-value-e2e-only-value";

test.beforeAll(async () => {
  await mkdir(SCREENSHOTS, { recursive: true });
});

test.afterEach(async () => {
  await clearSeededSyncs();
});

test("a signed-out visitor to admin is sent to sign-in", async ({ page }) => {
  await page.goto("/admin");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("admin: refused to a regular user, status rows, a failed sync and Sync now", async ({
  page,
}) => {
  const email = await createVerifiedAccount(page, "e2e-admin");

  await expect(page.getByRole("link", { name: "Settings" })).toBeVisible();
  await expect(page.getByRole("link", { name: "Admin" })).toHaveCount(0);
  const refused = await page.goto("/admin");
  expect(refused?.status()).toBe(404);
  await expect(page.getByText("This page could not be found.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sync now" })).toHaveCount(0);

  await makeAdmin(email);
  await page.goto("/dashboard");
  await page.getByRole("link", { name: "Admin" }).click();
  await expect(page).toHaveURL(/\/admin$/);
  await expect(page).toHaveTitle("Status · Koyomi");
  await expect(page.getByRole("heading", { level: 1, name: "Status" })).toBeVisible();
  await expect(page.getByText(/^\d+ \/ 290$/)).toBeVisible();
  await expect(page.getByText(/^\d+ \/ 10$/)).toBeVisible();
  await expect(page.getByText("LINE pushes counted in")).toBeVisible();
  await expect(page.getByText("Users with reminders switched on.")).toBeVisible();

  await seedFailedSync(`AnimeSchedule answered 500 to Bearer ${SERVER_SECRET}.`);
  await page.reload();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Reason: AnimeSchedule answered 500 to Bearer [BETTER_AUTH_SECRET]."),
  ).toBeVisible();
  await expect(page.getByText(SERVER_SECRET)).toHaveCount(0);
  expect(await page.content()).not.toContain(SERVER_SECRET);
  await scanBothThemes(page, (theme) => `${SCREENSHOTS}/admin-failed-${theme}.png`);

  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Synced: 7 episodes of 6 shows." }),
  ).toBeVisible();
  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible();
  await expect(page.getByText("7 episodes of 6 shows from fake")).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Reason:/)).toHaveCount(0);
  await scanBothThemes(page, (theme) => `${SCREENSHOTS}/admin-synced-${theme}.png`);

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
