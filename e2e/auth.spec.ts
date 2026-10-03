import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

import { emailedLink } from "./outbox";

const password = "e2e-journey-password";

// Buttons animate colour changes, so scanning right after a theme switch would read mid-transition colours.
const NO_TRANSITIONS = "*, *::before, *::after { transition: none !important; }";

async function seriousViolations(page: Page) {
  await page.addStyleTag({ content: NO_TRANSITIONS });
  const { violations } = await new AxeBuilder({ page }).analyze();
  return violations
    .filter(({ impact }) => impact === "serious" || impact === "critical")
    .map(({ id, help }) => `${id}: ${help}`);
}

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

test("a signed-out visitor to the dashboard is sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign up, verify the email, sign out and sign back in", async ({ page }) => {
  const email = `e2e-${Date.now()}@example.com`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);

  await page.goto(await emailedLink(email, "Verify your email"));
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();

  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toContainClass("dark");
  expect(await seriousViolations(page)).toEqual([]);

  await signOut(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  await expect(page.getByText(email)).toBeVisible();

  await signOut(page);
});

test("a wrong password shows a generic error and leaves the form usable", async ({ page }) => {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(`e2e-nobody-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();

  await expect(page.getByText("Invalid email or password.")).toBeVisible();
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(page.getByRole("button", { name: "Sign in", exact: true })).toBeEnabled();
});

for (const theme of ["light", "dark"]) {
  for (const path of [
    "/",
    "/sign-in",
    "/sign-up",
    "/forgot-password",
    "/verify-email",
    "/reset-password",
    "/reset-password?token=e2e",
  ]) {
    test(`${path} has no serious accessibility violations in the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((stored) => {
        window.localStorage.setItem("theme", stored);
      }, theme);
      await page.goto(path);
      await expect(page.locator("html")).toContainClass(theme);

      expect(await seriousViolations(page)).toEqual([]);
    });
  }
}
