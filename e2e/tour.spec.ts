import { mkdir } from "node:fs/promises";

import { expect, test, type Page } from "@playwright/test";

import { PASSWORD } from "./account";
import { LINE_SERVER } from "./line-server";
import { emailedLink, linePushes } from "./outbox";
import { followBehindTheServer, syncSchedule } from "./schedule";
import { linkLine, makeAdmin, removeLineLinks } from "./seed";

const SHOTS = ".e2e/tour";
const seeded: string[] = [];

test.use({ viewport: { width: 1280, height: 800 } });

test.beforeAll(async () => {
  await mkdir(SHOTS, { recursive: true });
});

test.afterEach(async () => {
  await removeLineLinks(seeded.splice(0));
});

async function shot(page: Page, name: string, fullPage = false) {
  if (fullPage) {
    await page.evaluate(async () => {
      for (let y = 0; y < document.body.scrollHeight; y += 600) {
        window.scrollTo(0, y);
        await new Promise((resolve) => setTimeout(resolve, 120));
      }
      window.scrollTo(0, 0);
    });
  }
  await page.waitForLoadState("networkidle");
  await page.mouse.move(0, 0);
  await page.screenshot({ path: `${SHOTS}/${name}.png`, fullPage });
}

test("tour: the whole flow with the fakes, one screenshot per step", async ({ page, baseURL }) => {
  test.setTimeout(120_000);
  const lantern = "Lantern Street Diaries";
  const email = `e2e-tour-${Date.now()}@example.com`;
  const tiles = page.getByRole("listitem");

  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  await shot(page, "01-landing");

  await syncSchedule(page.request, "base");
  await page.goto("/schedule");
  await expect(tiles.getByRole("link", { name: `Follow ${lantern}` })).toBeVisible();
  await shot(page, "02-schedule-signed-out", true);

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await shot(page, "03-sign-up");
  await expect(async () => {
    if (!/\/verify-email$/.test(page.url())) {
      await page.getByRole("button", { name: "Create account" }).click({ timeout: 1000 });
    }
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 3000 });
  }).toPass({ timeout: 25_000 });
  await shot(page, "04-verify-email");

  await page.goto(await emailedLink(email, "Verify your email"));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText("You are not following any shows yet.")).toBeVisible();
  await shot(page, "05-dashboard-empty");

  await page.goto("/schedule");
  await tiles.getByRole("button", { name: `Follow ${lantern}` }).click();
  await expect(tiles.getByRole("button", { name: `Unfollow ${lantern}` })).toBeVisible();
  await followBehindTheServer(email, "clockwork-orchard");
  await followBehindTheServer(email, "harbor-of-paper-cranes");
  await page.reload();
  await expect(tiles.filter({ hasText: lantern }).getByText("Following")).toBeVisible();
  await shot(page, "06-schedule-following", true);

  await page.getByRole("link", { name: "My week" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My week" })).toBeVisible();
  await expect(page.getByRole("region", { name: "Following" }).getByRole("listitem")).toHaveCount(
    2,
  );
  await expect(page.getByRole("region", { name: "Finished" }).getByRole("listitem")).toHaveCount(1);
  await shot(page, "07-dashboard-feature", true);

  const { lineUserId } = await linkLine(email, { reminderSlot: 5 });
  seeded.push(lineUserId);
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByText("Friend", { exact: true })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Reminders" })).toBeChecked();
  await shot(page, "08-settings-line-connected", true);

  await page.getByRole("button", { name: "Index" }).click();
  await expect(page.getByRole("button", { name: "Index" })).toHaveAttribute("aria-pressed", "true");
  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page.getByRole("heading", { level: 1, name: "My week" })).toBeVisible();
  await shot(page, "09-dashboard-index", true);

  const digest = await page.request.post("/api/dev/digest");
  expect(digest.status()).toBe(200);
  expect(await digest.json()).toMatchObject({ outcome: "enqueued", deliveries: { sent: 1 } });
  const pushes = await linePushes(lineUserId, 1);
  expect(pushes).toHaveLength(1);
  const text = pushes[0]?.text ?? "";
  expect(text).toContain("Airing today (Thai time):");
  expect(text).toContain(lantern);
  expect(text).toContain(`Your week: ${baseURL}/dashboard`);
  await page.setContent(
    `<main style="font: 16px/1.5 system-ui; max-width: 640px; margin: 48px auto; color: #222">
      <p style="font-size: 13px; color: #666">Fake LINE messenger: the one message the 09:00
      digest pushed to this user, read back from the server log. Not a LINE screen.</p>
      <pre id="push" style="white-space: pre-wrap; font: inherit; background: #f2f2f2;
      border: 1px solid #ccc; padding: 16px 20px; margin: 0"></pre></main>`,
  );
  await page.locator("#push").evaluate((el, value) => (el.textContent = value), text);
  await shot(page, "10-digest-message");

  await makeAdmin(email);
  await page.goto("/admin");
  await expect(page.getByRole("heading", { level: 1, name: "Status" })).toBeVisible();
  await page.getByRole("button", { name: "Sync now" }).click();
  await expect(page.getByRole("status").filter({ hasText: /^Synced:/ })).toBeVisible();
  await expect(page.getByText("Succeeded", { exact: true })).toBeVisible();
  await shot(page, "11-admin-status", true);

  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toContainClass("dark");
  await page.goto("/dashboard");
  await expect(page.getByRole("heading", { level: 1, name: "My week" })).toBeVisible();
  await shot(page, "12-dashboard-dark", true);
  await page.getByRole("button", { name: "Toggle theme" }).click();

  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).not.toHaveURL(/\/dashboard/);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in/);
  await shot(page, "13-signed-out-sign-in");

  await page.goto(`${LINE_SERVER}/sign-in`);
  await expect(page.getByRole("button", { name: "Log in with LINE", exact: true })).toBeVisible();
  await shot(page, "14-sign-in-with-line-on");
});
