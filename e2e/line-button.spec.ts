import { createHash } from "node:crypto";

import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator, type Page } from "@playwright/test";

import { LINE_LOGIN_BUTTON, scanBothThemes, seriousViolations } from "./axe";
import { LINE_SERVER } from "./line-server";

const PAGES = ["/sign-in", "/sign-up"];
const ICON = "/images/line-login-icon.png";
const ICON_SHA256 = "176c0751f3403e1ed5b496e86100d533749af461dc0499ba8f3bf7d308c652bc";
const SPEECH_BUBBLE = 32;
const ISOLATION = 6;

const GREEN = "rgb(6, 199, 85)";
const GREEN_HOVER = "rgb(5, 179, 77)";
const GREEN_PRESS = "rgb(4, 139, 60)";
const WHITE = "rgb(255, 255, 255)";
const RULE = "rgba(0, 0, 0, 0.08)";
const DISABLED_INK = "rgba(30, 30, 30, 0.2)";
const DISABLED_RULE = "rgba(229, 229, 229, 0.6)";

const lineButton = (page: Page) =>
  page.getByRole("button", { name: "Log in with LINE", exact: true });
const icon = (button: Locator) => button.locator("[data-line-icon]");
const label = (button: Locator) => button.locator("[data-line-label]");

function css(locator: Locator, property: string) {
  return locator.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);
}

function box(locator: Locator) {
  return locator.evaluate((el) => {
    const { left, right, top, bottom, width, height } = el.getBoundingClientRect();
    return { left, right, top, bottom, width, height };
  });
}

function textBox(locator: Locator) {
  return locator.evaluate((el) => {
    const range = document.createRange();
    range.selectNodeContents(el);
    const { left, right } = range.getBoundingClientRect();
    return { left, right, lines: range.getClientRects().length };
  });
}

function neighboursWithin(locator: Locator, distance: number) {
  return locator.evaluate((el, margin) => {
    const own = el.getBoundingClientRect();
    return [...document.body.querySelectorAll("*")]
      .filter((other) => !other.contains(el) && !el.contains(other))
      .filter((other) => {
        const rect = other.getBoundingClientRect();
        if (rect.width <= 1 || rect.height <= 1) return false;
        return (
          rect.left < own.right + margin &&
          rect.right > own.left - margin &&
          rect.top < own.bottom + margin &&
          rect.bottom > own.top - margin
        );
      })
      .map((other) => other.outerHTML.slice(0, 80));
  }, distance);
}

async function holdLineStart(page: Page) {
  let release = () => {};
  const held = new Promise<void>((resolve) => {
    release = resolve;
  });
  await page.route("**/api/auth/sign-in/social", async (route) => {
    await held;
    await route.abort();
  });
  return release;
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
      const button = lineButton(page);
      const frame = await box(button);
      expect(frame.height).toBe(44);
      expect(await css(button, "background-color")).toBe(GREEN);
      expect(await css(button, "color")).toBe(WHITE);
      expect(await css(button, "text-transform")).toBe("none");
      expect(await css(button, "font-size")).toBe("16px");
      expect(await css(button, "font-weight")).toBe("700");
      const form = await box(page.locator("form").first());
      expect(frame.width).toBe(form.width);

      const mark = await box(icon(button));
      expect(mark).toMatchObject({ width: 44, height: 44, left: frame.left, top: frame.top });
      expect(await css(icon(button), "mask-image")).toContain(ICON);
      expect(await css(icon(button), "background-color")).toBe(WHITE);
      await expect(icon(button)).toHaveAttribute("aria-hidden", "true");

      const text = await box(label(button));
      expect(text.left).toBe(mark.right);
      expect(text.right).toBe(frame.right);
      expect(await css(label(button), "border-left-width")).toBe("1px");
      expect(await css(label(button), "border-left-color")).toBe(RULE);

      const letters = await textBox(label(button));
      expect(letters.lines).toBe(1);
      expect(letters.left - text.left).toBeGreaterThanOrEqual(SPEECH_BUBBLE);
      expect(text.right - letters.right).toBeGreaterThanOrEqual(SPEECH_BUBBLE);

      expect(await neighboursWithin(button, ISOLATION)).toEqual([]);
    });

    test("darkens as LINE asks under the pointer and while pressed", async ({ page }) => {
      const button = lineButton(page);
      await button.hover();
      expect(await css(button, "background-color")).toBe(GREEN_HOVER);
      await page.mouse.down();
      expect(await css(button, "background-color")).toBe(GREEN_PRESS);
      await page.mouse.move(0, 0);
      await page.mouse.up();
      expect(await css(button, "background-color")).toBe(GREEN);
      await expect(page).toHaveURL(`${LINE_SERVER}${path}`);
    });

    test("takes LINE's disabled colours while the redirect is pending", async ({ page }) => {
      const release = await holdLineStart(page);
      const button = lineButton(page);
      await button.click();

      await expect(button).toBeDisabled();
      await expect(button).toHaveAttribute("aria-busy", "true");
      expect(await css(button, "background-color")).toBe(WHITE);
      expect(await css(button, "color")).toBe(DISABLED_INK);
      expect(await css(button, "box-shadow")).toContain(DISABLED_RULE);
      expect(await css(icon(button), "background-color")).toBe(DISABLED_INK);
      expect(await css(label(button), "border-left-color")).toBe(DISABLED_RULE);

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
      const button = lineButton(page);
      for (let presses = 0; presses < 20; presses++) {
        await page.keyboard.press("Tab");
        if (await button.evaluate((el) => el === document.activeElement)) break;
      }
      await expect(button).toBeFocused();
      expect(await css(button, "box-shadow")).not.toBe("none");
    });
  });
}
