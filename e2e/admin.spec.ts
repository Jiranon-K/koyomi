import { mkdir } from "node:fs/promises";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createVerifiedAccount } from "./account";
import { clearSeededSyncs, makeAdmin, seedFailedSync } from "./seed";

// Same scan as e2e/settings.spec.ts: the admin page is private, so it is scanned inside a journey.
const NO_TRANSITIONS = "*, *::before, *::after { transition: none !important; }";
// Git-ignored, beside the server log: what the page looked like in the last run.
const SCREENSHOTS = ".e2e/screenshots";
// The secret e2e/server.mjs starts the server with. A failure reason that repeats it must not
// reach the page.
const SERVER_SECRET = "e2e-only-value-e2e-only-value-e2e-only-value";

async function seriousViolations(page: Page) {
  await page.addStyleTag({ content: NO_TRANSITIONS });
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, help }) => `${id}: ${help}`);
}

/** Scans the page in the theme it is in and in the other one, and keeps a screenshot of each. */
async function scanBothThemes(page: Page, name: string) {
  const html = page.locator("html");
  const start = (await html.getAttribute("class"))?.includes("dark") ? "dark" : "light";
  const other = start === "dark" ? "light" : "dark";

  expect(await seriousViolations(page)).toEqual([]);
  await page.screenshot({ path: `${SCREENSHOTS}/${name}-${start}.png`, fullPage: true });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(html).toContainClass(other);
  expect(await seriousViolations(page)).toEqual([]);
  await page.screenshot({ path: `${SCREENSHOTS}/${name}-${other}.png`, fullPage: true });
}

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

// One sign-up and no sign-in: the sign-in budget of a run (5 a minute) is left alone.
test("admin: refused to a regular user, status rows, a failed sync and Sync now", async ({
  page,
}) => {
  const email = await createVerifiedAccount(page, "e2e-admin");

  // A regular user has no link to the page and gets a 404 for it.
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

  // A failed sync shows as failed with its reason, and a secret in the reason is not repeated.
  await seedFailedSync(`AnimeSchedule answered 500 to Bearer ${SERVER_SECRET}.`);
  await page.reload();
  await expect(page.getByText("Failed", { exact: true })).toBeVisible();
  await expect(
    page.getByText("Reason: AnimeSchedule answered 500 to Bearer [BETTER_AUTH_SECRET]."),
  ).toBeVisible();
  await expect(page.getByText(SERVER_SECRET)).toHaveCount(0);
  expect(await page.content()).not.toContain(SERVER_SECRET);
  await scanBothThemes(page, "admin-failed");

  // Sync now runs the sync (the fake source) and the page shows the new result.
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Synced: 7 episodes of 6 shows." }),
  ).toBeVisible();
  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible();
  await expect(page.getByText("7 episodes of 6 shows from fake")).toBeVisible();
  await expect(page.getByText("Failed", { exact: true })).toHaveCount(0);
  await expect(page.getByText(/^Reason:/)).toHaveCount(0);
  await scanBothThemes(page, "admin-synced");

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
