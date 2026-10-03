import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { emailedLink } from "./outbox";

export const PASSWORD = "e2e-journey-password";

/** Sign up a fresh account and follow its verification link; ends signed in on the dashboard. */
export async function createVerifiedAccount(page: Page, prefix = "e2e") {
  const email = `${prefix}-${Date.now()}@example.com`;

  await page.goto("/sign-up");
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/verify-email$/);

  await page.goto(await emailedLink(email, "Verify your email"));
  await expect(page).toHaveURL(/\/dashboard$/);

  return email;
}
