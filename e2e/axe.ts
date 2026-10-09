import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const NO_TRANSITIONS = "*, *::before, *::after { transition: none !important; }";
const SERIOUS = ["serious", "critical"];

export const LINE_LOGIN_BUTTON = "[data-line-login]";

export async function seriousViolations(page: Page) {
  // A Server Action's refresh re-mounts <title>; a scan in that gap reports a page without one.
  await expect(page, "the page has a title to scan").not.toHaveTitle("");
  await page.addStyleTag({ content: NO_TRANSITIONS });
  const scans = [await new AxeBuilder({ page }).exclude(LINE_LOGIN_BUTTON).analyze()];
  if ((await page.locator(LINE_LOGIN_BUTTON).count()) > 0) {
    scans.push(
      await new AxeBuilder({ page })
        .include(LINE_LOGIN_BUTTON)
        .disableRules(["color-contrast"])
        .analyze(),
    );
  }
  return scans
    .flatMap(({ violations }) => violations)
    .filter(({ impact }) => impact && SERIOUS.includes(impact))
    .map(({ id, help }) => `${id}: ${help}`);
}

export async function scanBothThemes(page: Page, screenshot?: (theme: string) => string) {
  const html = page.locator("html");
  const start = (await html.getAttribute("class"))?.includes("dark") ? "dark" : "light";
  const other = start === "dark" ? "light" : "dark";

  expect(await seriousViolations(page)).toEqual([]);
  if (screenshot) await page.screenshot({ path: screenshot(start), fullPage: true });
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(html).toContainClass(other);
  expect(await seriousViolations(page)).toEqual([]);
  if (screenshot) await page.screenshot({ path: screenshot(other), fullPage: true });
}
