import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { createVerifiedAccount } from "./account";
import { clearFillers, fillReminderSlots, linkLine } from "./seed";

// Same scan as e2e/auth.spec.ts: settings is a private page, so it is scanned inside a journey.
const NO_TRANSITIONS = "*, *::before, *::after { transition: none !important; }";

async function seriousViolations(page: Page) {
  await page.addStyleTag({ content: NO_TRANSITIONS });
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, help }) => `${id}: ${help}`);
}

async function scanBothThemes(page: Page) {
  const start = (await page.locator("html").getAttribute("class"))?.includes("dark")
    ? "dark"
    : "light";
  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toContainClass(start === "dark" ? "light" : "dark");
  expect(await seriousViolations(page)).toEqual([]);
}

const reminders = (page: Page) => page.getByRole("switch", { name: "Reminders" });

test.afterEach(async () => {
  await clearFillers();
});

test("a signed-out visitor to settings is sent to sign-in", async ({ page }) => {
  await page.goto("/settings");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("the LINE webhook refuses every call while no channel secret is configured", async ({
  request,
}) => {
  const response = await request.post("/api/line/webhook", {
    headers: { "x-line-signature": "anything" },
    data: { events: [] },
  });

  expect(response.status()).toBe(503);
});

test("no LINE button is offered while LINE Login is not configured", async ({ page }) => {
  for (const path of ["/sign-in", "/sign-up", "/sign-in?error=email_not_verified"]) {
    await page.goto(path);
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
    await expect(page.getByRole("button", { name: /LINE/ })).toHaveCount(0);
    await expect(page.getByText(/LINE sign-in/)).toHaveCount(0);
  }
});

test("settings: connection state, the reminder switch, the cap and disconnecting", async ({
  page,
}) => {
  const email = await createVerifiedAccount(page, "e2e-settings");

  // Not connected, and this server has no LINE Login channel, so there is nothing to press.
  await page.getByRole("link", { name: "Settings" }).click();
  await expect(page).toHaveURL(/\/settings$/);
  await expect(page).toHaveTitle("Settings · Koyomi");
  await expect(page.getByText("Not connected")).toBeVisible();
  await expect(page.getByText("LINE is not set up on this server yet.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect LINE" })).toHaveCount(0);
  await expect(reminders(page)).toHaveCount(0);
  await scanBothThemes(page);

  // A linked user who is a friend of the bot and holds a reminder place.
  await linkLine(email, { reminderSlot: 1 });
  await page.reload();
  await expect(page.getByText("Connected", { exact: true })).toBeVisible();
  await expect(page.getByText("Friend", { exact: true })).toBeVisible();
  await expect(reminders(page)).toBeChecked();
  await expect(page.getByText("You get one LINE message at 09:00")).toBeVisible();
  await scanBothThemes(page);

  await reminders(page).click();
  await expect(reminders(page)).not.toBeChecked();
  await expect(page.getByText("No messages are sent while this is off.")).toBeVisible();
  await scanBothThemes(page);

  // Ten other users hold every place: the eleventh is told so, and stays off.
  await fillReminderSlots(1);
  await reminders(page).click();
  await expect(page.getByRole("alert").filter({ hasText: "Reminders are full" })).toBeVisible();
  await expect(reminders(page)).not.toBeChecked();
  expect(await seriousViolations(page)).toEqual([]);

  await clearFillers();
  await reminders(page).click();
  await expect(reminders(page)).toBeChecked();
  await expect(page.getByText("Reminders are full")).toHaveCount(0);

  await page.getByRole("button", { name: "Disconnect" }).click();
  await expect(page.getByText("Not connected")).toBeVisible();
  await expect(reminders(page)).toHaveCount(0);

  await page.getByRole("link", { name: "Dashboard" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
});
