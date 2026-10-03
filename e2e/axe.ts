import AxeBuilder from "@axe-core/playwright";
import { expect, type Page } from "@playwright/test";

const NO_TRANSITIONS = "*, *::before, *::after { transition: none !important; }";

export async function seriousViolations(page: Page) {
  await page.addStyleTag({ content: NO_TRANSITIONS });
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
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
