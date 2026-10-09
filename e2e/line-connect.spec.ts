import { expect, test } from "@playwright/test";

import { createVerifiedAccount } from "./account";
import { scanBothThemes } from "./axe";
import {
  box,
  expectDisabledLook,
  expectFocusRingByKeyboard,
  expectHoverAndPress,
  expectLineLook,
  gate,
  lineButton,
} from "./line-look";
import { LINE_E2E_SERVER, LINE_LOGIN_CHANNEL_ID, LINE_SERVER } from "./line-server";

const MAX_WIDTH = 320;
const PHONE = { width: 320, height: 640 };
const LINE_AUTHORIZE = /^https:\/\/access\.line\.me\//;

test("settings: the LINE button looks like LINE's and starts connecting LINE", async ({ page }) => {
  await createVerifiedAccount(page, "e2e-line-connect", LINE_E2E_SERVER);
  await page.goto(`${LINE_SERVER}/settings`);
  await expect(page.getByText("Not connected")).toBeVisible();
  await expect(page.getByText("Log in with LINE to connect it to this account.")).toBeVisible();
  await expect(page.getByRole("button", { name: /LINE/ })).toHaveCount(1);

  const button = lineButton(page);
  const frame = await expectLineLook(button);
  expect(frame.width).toBe(MAX_WIDTH);
  expect(frame.left).toBeCloseTo((await box(page.getByText("Not connected"))).left, 0);

  await expectHoverAndPress(page, button);
  await expect(page).toHaveURL(`${LINE_SERVER}/settings`);

  await scanBothThemes(page, (theme) => `.e2e/screenshots/line-connect-${theme}.png`);
  await page.mouse.move(0, 0);
  await expect(page.locator("html")).toContainClass("dark");
  const desktop = page.viewportSize();
  await page.setViewportSize(PHONE);
  const narrow = await expectLineLook(button);
  expect(narrow.width).toBeLessThan(MAX_WIDTH);
  expect(narrow.right).toBeLessThanOrEqual(PHONE.width);
  if (desktop) await page.setViewportSize(desktop);
  await expectFocusRingByKeyboard(page, button);

  const { opened, open } = gate();
  await page.route(`${LINE_SERVER}/settings`, async (route) => {
    if (route.request().method() === "POST") await opened;
    await route.continue();
  });
  await page.route(LINE_AUTHORIZE, (route) =>
    route.fulfill({ contentType: "text/html", body: "<h1>Stub, not LINE</h1>" }),
  );

  await button.click();
  await expectDisabledLook(button);

  open();
  await expect(page.getByRole("heading", { name: "Stub, not LINE" })).toBeVisible();
  const authorize = new URL(page.url());
  expect(authorize.href).toMatch(LINE_AUTHORIZE);
  expect(authorize.searchParams.get("client_id")).toBe(LINE_LOGIN_CHANNEL_ID);
});
