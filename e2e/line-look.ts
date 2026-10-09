import { expect, type Locator, type Page } from "@playwright/test";

export const ICON = "/images/line-login-icon.png";
const SPEECH_BUBBLE = 32;
const ISOLATION = 6;

export const GREEN = "rgb(6, 199, 85)";
const GREEN_HOVER = "rgb(5, 179, 77)";
const GREEN_PRESS = "rgb(4, 139, 60)";
export const WHITE = "rgb(255, 255, 255)";
const RULE = "rgba(0, 0, 0, 0.08)";
const DISABLED_INK = "rgba(30, 30, 30, 0.2)";
const DISABLED_RULE = "rgba(229, 229, 229, 0.6)";

export const lineButton = (page: Page) =>
  page.getByRole("button", { name: "Log in with LINE", exact: true });
const icon = (button: Locator) => button.locator("[data-line-icon]");
const label = (button: Locator) => button.locator("[data-line-label]");

export function css(locator: Locator, property: string) {
  return locator.evaluate((el, name) => getComputedStyle(el).getPropertyValue(name), property);
}

export function box(locator: Locator) {
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

export function gate() {
  let open = () => {};
  const opened = new Promise<void>((resolve) => {
    open = resolve;
  });
  return { opened, open };
}

export async function expectLineLook(button: Locator) {
  const frame = await box(button);
  expect(frame.height).toBe(44);
  expect(await css(button, "background-color")).toBe(GREEN);
  expect(await css(button, "color")).toBe(WHITE);
  expect(await css(button, "text-transform")).toBe("none");
  expect(await css(button, "font-size")).toBe("16px");
  expect(await css(button, "font-weight")).toBe("700");

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
  return frame;
}

export async function expectHoverAndPress(page: Page, button: Locator) {
  await button.hover();
  expect(await css(button, "background-color")).toBe(GREEN_HOVER);
  await page.mouse.down();
  expect(await css(button, "background-color")).toBe(GREEN_PRESS);
  await page.mouse.move(0, 0);
  await page.mouse.up();
  expect(await css(button, "background-color")).toBe(GREEN);
}

export async function expectDisabledLook(button: Locator) {
  await expect(button).toBeDisabled();
  await expect(button).toHaveAttribute("aria-busy", "true");
  expect(await css(button, "background-color")).toBe(WHITE);
  expect(await css(button, "color")).toBe(DISABLED_INK);
  expect(await css(button, "box-shadow")).toContain(DISABLED_RULE);
  expect(await css(icon(button), "background-color")).toBe(DISABLED_INK);
  expect(await css(label(button), "border-left-color")).toBe(DISABLED_RULE);
}

export async function expectFocusRingByKeyboard(page: Page, button: Locator) {
  for (let presses = 0; presses < 30; presses++) {
    await page.keyboard.press("Tab");
    if (await button.evaluate((el) => el === document.activeElement)) break;
  }
  await expect(button).toBeFocused();
  expect(await css(button, "box-shadow")).not.toBe("none");
}
