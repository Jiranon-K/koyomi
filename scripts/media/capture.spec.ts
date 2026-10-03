import { mkdir } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { PASSWORD } from "../../e2e/account";
import { emailedLink } from "../../e2e/outbox";

// The schedule picture stops after the first row of tiles; later rows hold shows that are not Japanese.
const SCHEDULE_HEIGHT = 1240;
const OUT = "docs/images";
const EMAIL = "demo@example.com";
// Japanese shows to follow, matched by title when the schedule has them.
const JAPANESE_SHOWS = [
  "Kikansha no Mahou wa Tokubetsu desu Season 2",
  "JoJo no Kimyou na Bouken Part 7",
  "Chiikawa",
  "Ghost Meets Gal!",
  "Crayon Shin-chan",
  "Shiotaiou no Satou-san",
  "Kyouran Reijou Nia Liston",
];

test.use({ colorScheme: "light" });

test("a walk through the real product", async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  const pause = (ms: number) => page.waitForTimeout(ms);
  const still = async (name: string, height = 0) => {
    await pause(1500);
    // Lazy covers load only when scrolled near, so walk down the part that is captured first.
    for (let y = 0; y <= 1900; y += 450) {
      await page.evaluate((top) => window.scrollTo(0, top), y);
      await pause(250);
    }
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForFunction(
      () =>
        [...document.images]
          .filter((image) => image.getBoundingClientRect().top + window.scrollY < 1900)
          .every((image) => image.complete),
      null,
      { timeout: 30_000 },
    );
    await pause(1500);
    await page.screenshot({
      path: `${OUT}/${name}.png`,
      ...(height && { fullPage: true, clip: { x: 0, y: 0, width: 1440, height } }),
    });
  };

  await page.goto("/");
  await still("landing");

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Demo");
  await page.getByLabel("Email address").fill(EMAIL);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await expect(async () => {
    if (!/\/verify-email$/.test(page.url())) {
      await page.getByRole("button", { name: "Create account" }).click({ timeout: 1000 });
    }
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 3000 });
  }).toPass({ timeout: 25_000 });
  await pause(1200);
  await page.goto(await emailedLink(EMAIL, "Verify your email"));
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.goto("/admin");
  await page.getByRole("button", { name: /sync/i }).click();
  await expect(page.getByText("Succeeded")).toBeVisible({ timeout: 120_000 });
  await still("admin");

  await page.goto("/schedule");
  await still("schedule", SCHEDULE_HEIGHT);
  await page.mouse.wheel(0, 900);
  await pause(1500);
  await page.mouse.wheel(0, 900);
  await pause(1500);

  for (const title of JAPANESE_SHOWS) {
    const follow = page.getByRole("listitem").getByRole("button", { name: `Follow ${title}` });
    if (await follow.count()) {
      await follow.first().click();
      await pause(700);
    }
  }

  await page.goto("/dashboard");
  await still("dashboard", 1900);
  await page.mouse.wheel(0, 900);
  await pause(2000);

  await page.goto("/settings");
  await page.getByRole("button", { name: "Index" }).click();
  await pause(1200);
  await page.goto("/dashboard");
  await still("dashboard-index", 1900);
});
