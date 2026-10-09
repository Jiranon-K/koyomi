import { createHash } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { LINE_LOGIN_BUTTON, scanBothThemes, seriousViolations } from "./axe";
import {
  box,
  css,
  expectDisabledLook,
  expectFocusRingByKeyboard,
  expectHoverAndPress,
  expectLineLook,
  gate,
  GREEN,
  ICON,
  lineButton,
  WHITE,
} from "./line-look";
import { LINE_SERVER } from "./line-server";

const PAGES = ["/sign-in", "/sign-up"];
const ICON_SHA256 = "176c0751f3403e1ed5b496e86100d533749af461dc0499ba8f3bf7d308c652bc";

async function holdLineStart(page: Page) {
  const { opened, open } = gate();
  await page.route("**/api/auth/sign-in/social", async (route) => {
    await opened;
    await route.abort();
  });
  return open;
}

test("the icon is LINE's file, unchanged", async ({ request }) => {
  const response = await request.get(`${LINE_SERVER}${ICON}`);
  expect(response.status()).toBe(200);
  expect(
    createHash("sha256")
      .update(await response.body())
      .digest("hex"),
  ).toBe(ICON_SHA256);
});

for (const path of PAGES) {
  test.describe(`the LINE Login button on ${path}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.goto(`${LINE_SERVER}${path}`);
      await expect(lineButton(page)).toBeVisible();
    });

    test("has LINE's colours, icon, vertical line and spacing", async ({ page }) => {
      const frame = await expectLineLook(lineButton(page));
      const form = await box(page.locator("form").first());
      expect(frame.width).toBe(form.width);
    });

    test("darkens as LINE asks under the pointer and while pressed", async ({ page }) => {
      await expectHoverAndPress(page, lineButton(page));
      await expect(page).toHaveURL(`${LINE_SERVER}${path}`);
    });

    test("takes LINE's disabled colours while the redirect is pending", async ({ page }) => {
      const release = await holdLineStart(page);
      const button = lineButton(page);
      await button.click();

      await expectDisabledLook(button);

      release();
      await expect(page.getByRole("alert").filter({ hasText: /\S/ })).toBeVisible();
      await expect(button).toBeEnabled();
      await page.mouse.move(0, 0);
      expect(await css(button, "background-color")).toBe(GREEN);
    });

    test("is excused from the contrast rule, and nothing else is", async ({ page }) => {
      const contrast = await new AxeBuilder({ page })
        .include(LINE_LOGIN_BUTTON)
        .withRules(["color-contrast"])
        .analyze();
      expect(contrast.violations.map(({ id }) => id)).toEqual(["color-contrast"]);

      expect(await seriousViolations(page)).toEqual([]);

      await lineButton(page).evaluate((el) => {
        const faint = document.createElement("p");
        faint.id = "faint";
        faint.textContent = "Barely there";
        faint.style.cssText = "color: #cccccc; background: #ffffff";
        el.insertAdjacentElement("afterend", faint);
      });
      expect(await seriousViolations(page)).toEqual([
        "color-contrast: Elements must meet minimum color contrast ratio thresholds",
      ]);
      await page.locator("#faint").evaluate((el) => el.remove());

      await scanBothThemes(page);
      await page.mouse.move(0, 0);
      expect(await css(lineButton(page), "background-color")).toBe(GREEN);
      expect(await css(lineButton(page), "color")).toBe(WHITE);
    });

    test("shows a focus ring when reached with the keyboard", async ({ page }) => {
      await expectFocusRingByKeyboard(page, lineButton(page));
    });
  });
}
