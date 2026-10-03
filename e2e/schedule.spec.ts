import { expect, test } from "@playwright/test";

import { renameShowBehindTheServer, syncSchedule } from "./schedule";

test.beforeEach(async ({ request }) => {
  await syncSchedule(request, "base");
});

test("a visitor sees the week in Thai time, grouped by schedule day", async ({ page }) => {
  await page.goto("/schedule");

  await expect(page).toHaveTitle("Schedule · Koyomi");
  await expect(page.getByRole("heading", { level: 1, name: "This week" })).toBeVisible();
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(7);

  const today = page.getByRole("region").first();
  await expect(today.getByText("Today")).toBeVisible();
  await expect(today.getByRole("listitem")).toHaveText([
    /22:30.*Lantern Street Diaries.*Episode 5/,
    /00:30.*Clockwork Orchard.*Episode 3/,
  ]);
});

test("a delayed episode is marked and the source is credited", async ({ page }) => {
  await page.goto("/schedule");

  const delayed = page.getByRole("listitem").filter({ hasText: "Salt and Starlight" });
  await expect(delayed.getByText("Delayed", { exact: true })).toBeVisible();
  await expect(delayed).toContainText("Delayed one week");
  await expect(page.getByRole("link", { name: "AnimeSchedule.net" })).toHaveAttribute(
    "href",
    "https://animeschedule.net",
  );
});

test("the page is served from the cache until a sync succeeds", async ({ page, request }) => {
  const row = page.getByRole("listitem").filter({ hasText: "The Ninth Platform" });

  await page.goto("/schedule");
  await expect(row).toBeVisible();
  await expect(row.getByText("Delayed", { exact: true })).toHaveCount(0);

  await renameShowBehindTheServer("the-ninth-platform", "Renamed Behind The Cache");
  await page.reload();
  await expect(row).toBeVisible();
  await expect(page.getByText("Renamed Behind The Cache")).toHaveCount(0);

  await syncSchedule(request, "revised");
  await page.reload();
  await expect(row.getByText("Delayed", { exact: true })).toBeVisible();
});

test("the landing page links to the schedule, which needs no account", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "See this week" }).click();

  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("heading", { level: 1, name: "This week" })).toBeVisible();
});
