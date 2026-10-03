import { expect, test } from "@playwright/test";

import { renameShowBehindTheServer, syncSchedule } from "./schedule";

test.beforeEach(async ({ request }) => {
  await syncSchedule(request, "base");
});

test("a visitor sees the week in Thai time, grouped by schedule day", async ({ page }) => {
  await page.goto("/schedule");

  await expect(page).toHaveTitle("Schedule · Koyomi");
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(["On air this week"]);
  await expect(page.getByRole("heading", { level: 2 })).toHaveCount(7);
  await expect(page.getByRole("region")).toHaveCount(7);

  const today = page.getByRole("region").first();
  await expect(today.getByRole("heading", { level: 2, name: "Today" })).toBeVisible();
  await expect(today.getByText("2 episodes")).toBeVisible();
  await expect(page.getByRole("region").nth(3).getByText("Nothing airs.")).toBeVisible();
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
  await expect(page.getByRole("heading", { level: 1, name: "On air this week" })).toBeVisible();
});

test("the page opens with the next episode to air, and only its cover loads eagerly", async ({
  page,
}) => {
  await page.goto("/schedule");

  const upNext = page.getByRole("group", { name: "Up next" });
  await expect(
    upNext.getByText(/^(now|in \d+ (min|h|d)( \d+ (min|h))?)$/, { exact: true }),
  ).toBeVisible();
  await expect(upNext.locator("time")).toHaveText(/^\d{2}:\d{2}$/);
  await expect(upNext.getByText(/^Episodes? \d+/)).toBeVisible();
  await expect(upNext.getByRole("link", { name: /^Follow / })).toBeVisible();
  await expect(
    page.getByText(/\d+ still to air today, \d+ already out(, \d+ delayed)?\./),
  ).toBeVisible();
  await expect(upNext.locator("xpath=preceding::img[1]")).toHaveAttribute("loading", "eager");

  const loading = await page
    .locator("main img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("loading")));
  expect(loading.filter((value) => value === "eager")).toHaveLength(1);
  const tileLoading = await page
    .getByRole("listitem")
    .locator("img")
    .evaluateAll((images) => images.map((image) => image.getAttribute("loading")));
  expect(new Set(tileLoading)).toEqual(new Set(["lazy"]));
});

test("a show with a cover shows it from this server, one without gets a title tile", async ({
  page,
  baseURL,
}) => {
  const origins = new Set<string>();
  page.on("request", (request) => origins.add(new URL(request.url()).origin));

  await page.goto("/schedule");

  const covered = page.getByRole("listitem").filter({ hasText: "Lantern Street Diaries" });
  const cover = covered.locator("img");
  await expect(cover).toHaveAttribute("alt", "");
  await expect(cover).toHaveAttribute("src", /^\/_next\/image\?url=%2Fimages%2Ffake-covers%2F/);
  await expect
    .poll(() => cover.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);

  const bare = page.getByRole("listitem").filter({ hasText: "Moss and Thunder" });
  await bare.scrollIntoViewIfNeeded();
  await expect(bare.locator("img")).toHaveCount(0);
  await expect(bare.getByText("Moss and Thunder")).toHaveCount(2);
  await expect(bare).toContainText(/05:00.*Moss and Thunder.*Episode 1/);
  await expect(bare.getByRole("link", { name: "Follow Moss and Thunder" })).toBeVisible();

  expect([...origins]).toEqual([new URL(baseURL ?? "").origin]);
});

test("the day links stay in view and jump to a day without hiding its heading", async ({
  page,
}) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto("/schedule");

  const days = page.getByRole("navigation", { name: "Jump to a day" });
  await expect(days.getByRole("link")).toHaveCount(7);
  await expect(days.getByRole("link").first()).toHaveAccessibleName(/^Today, .*, 2 episodes$/);

  await days.getByRole("link").last().click();
  await expect(page).toHaveURL(/\/schedule#day-\d{4}-\d{2}-\d{2}$/);

  const heading = page.getByRole("region").last().getByRole("heading", { level: 2 });
  await expect(heading).toBeInViewport();
  await expect(days).toBeInViewport();
  const bar = await days.boundingBox();
  const title = await heading.boundingBox();
  expect(title?.y).toBeGreaterThanOrEqual((bar?.y ?? 0) + (bar?.height ?? 0));
});

for (const width of [320, 375]) {
  test(`the wall and its day links fit a ${width}px phone without spilling`, async ({ page }) => {
    await page.setViewportSize({ width, height: 812 });
    await page.goto("/schedule");
    await expect(page.getByRole("region")).toHaveCount(7);

    const pageOverflow = await page.evaluate(() => {
      const root = document.documentElement;
      return root.scrollWidth - root.clientWidth;
    });
    expect(pageOverflow).toBe(0);

    const links = page.getByRole("navigation", { name: "Jump to a day" }).getByRole("link");
    const spills = await links.evaluateAll((cells) =>
      cells.map((cell) => {
        const box = cell.getBoundingClientRect();
        return [...cell.children].some((child) => {
          const inner = child.getBoundingClientRect();
          return inner.left < box.left || inner.right > box.right;
        });
      }),
    );
    expect(spills).toEqual(Array.from({ length: 7 }, () => false));
    await expect(links.first()).toContainText("2");
  });
}

test("keyboard focus on a tile is not hidden under the day links", async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 500 });
  await page.goto("/schedule");
  const days = page.getByRole("navigation", { name: "Jump to a day" });

  await page.getByRole("link", { name: "AnimeSchedule.net" }).focus();
  await page.keyboard.press("Shift+Tab");
  const follow = page.getByRole("listitem").getByRole("link", { name: "Follow Moss and Thunder" });
  await expect(follow).toBeFocused();

  const bar = await days.boundingBox();
  const button = await follow.boundingBox();
  expect(button?.y).toBeGreaterThanOrEqual((bar?.y ?? 0) + (bar?.height ?? 0));
});
