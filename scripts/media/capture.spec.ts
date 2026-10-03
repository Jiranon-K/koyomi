import { mkdir, rename } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { PASSWORD } from "../../e2e/account";
import { emailedLink } from "../../e2e/outbox";

const OUT = "docs/images";
const EMAIL = "demo@example.com";
const FOLLOW_COUNT = 6;

test.use({ colorScheme: "light" });

test("a walk through the real product", async ({ page }, testInfo) => {
  await mkdir(OUT, { recursive: true });
  const pause = (ms: number) => page.waitForTimeout(ms);
  const still = async (name: string, tall = false) => {
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
      ...(tall && { fullPage: true, clip: { x: 0, y: 0, width: 1440, height: 1900 } }),
    });
  };

  await page.goto("/");
  await still("landing");

  await page.goto("/sign-up");
  await still("sign-up");
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
  await still("schedule", true);
  await page.mouse.wheel(0, 900);
  await pause(1500);
  await page.mouse.wheel(0, 900);
  await pause(1500);

  const follow = page.getByRole("listitem").getByRole("button", { name: /^Follow / });
  const count = await follow.count();
  const picks = Array.from({ length: FOLLOW_COUNT }, (_, i) =>
    Math.floor((count * (i + 0.5)) / FOLLOW_COUNT),
  );
  for (const index of [...new Set(picks)].reverse()) {
    await follow.nth(index).click();
    await pause(700);
  }

  await page.goto("/dashboard");
  await still("dashboard", true);
  await page.mouse.wheel(0, 900);
  await pause(2000);

  await page.goto("/settings");
  await still("settings");
  await page.getByRole("button", { name: "Index" }).click();
  await pause(1200);
  await page.goto("/dashboard");
  await still("dashboard-index", true);

  const video = page.video();
  await page.close();
  if (video) await rename(await video.path(), testInfo.outputPath("clip.webm"));
});
