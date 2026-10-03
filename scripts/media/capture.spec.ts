import { mkdir, rename } from "node:fs/promises";

import { expect, test } from "@playwright/test";

import { createVerifiedAccount } from "../../e2e/account";
import { followBehindTheServer, syncSchedule } from "../../e2e/schedule";
import { chooseDashboardView, linkLine, makeAdmin } from "../../e2e/seed";

const OUT = "docs/images";
const VIEWPORT = { width: 1440, height: 900 };
const FOLLOWED = [
  "lantern-street-diaries",
  "clockwork-orchard",
  "salt-and-starlight",
  "the-ninth-platform",
  "moss-and-thunder",
];

test.use({ viewport: VIEWPORT, reducedMotion: "reduce" });

test("stills of every page in both themes", async ({ page }) => {
  await mkdir(OUT, { recursive: true });
  await syncSchedule(page.request, "base");

  const shot = async (name: string, theme: "light" | "dark", path: string, tall = false) => {
    await page.goto(path);
    await page.evaluate((value) => localStorage.setItem("theme", value), theme);
    await page.reload();
    await page.waitForLoadState("networkidle");
    await expect(page.locator("html")).toHaveClass(new RegExp(theme));
    await page.screenshot({
      path: `${OUT}/${name}-${theme}.png`,
      ...(tall && { fullPage: true, clip: { x: 0, y: 0, width: 1440, height: 1900 } }),
    });
  };

  for (const theme of ["light", "dark"] as const) {
    await shot("landing", theme, "/");
    await shot("schedule", theme, "/schedule", true);
    await shot("sign-in", theme, "/sign-in");
  }

  await page.emulateMedia({ colorScheme: "light", reducedMotion: "reduce" });
  const email = await createVerifiedAccount(page, "media");
  for (const route of FOLLOWED) await followBehindTheServer(email, route);
  await makeAdmin(email);
  await linkLine(email, { reminderSlot: 1 });

  for (const theme of ["light", "dark"] as const) {
    await shot("dashboard", theme, "/dashboard", true);
    await shot("settings", theme, "/settings");
    await shot("admin", theme, "/admin");
  }

  await chooseDashboardView(email, "index");
  for (const theme of ["light", "dark"] as const) {
    await shot("dashboard-index", theme, "/dashboard", true);
  }
});

test.describe("clip", () => {
  test.use({ reducedMotion: "no-preference" });

  test("a walk through the product", async ({ page }, testInfo) => {
    await syncSchedule(page.request, "base");
    const pause = (ms: number) => page.waitForTimeout(ms);

    await page.goto("/");
    await pause(3500);
    await page.goto("/schedule");
    await pause(2500);
    await page.mouse.wheel(0, 700);
    await pause(1500);
    await page.mouse.wheel(0, 700);
    await pause(1500);

    const email = await createVerifiedAccount(page, "clip");
    for (const route of FOLLOWED) await followBehindTheServer(email, route);
    await linkLine(email, { reminderSlot: 2 });
    await page.goto("/dashboard");
    await pause(4500);
    await page.mouse.wheel(0, 800);
    await pause(2000);
    await page.goto("/settings");
    await pause(2500);
    await page.getByRole("button", { name: "Index" }).click();
    await pause(1200);
    await page.goto("/dashboard");
    await pause(3500);
    await expect(page.getByRole("heading", { level: 1, name: "My week" })).toBeVisible();

    const video = page.video();
    await page.close();
    if (video) await rename(await video.path(), testInfo.outputPath("clip.webm"));
  });
});
