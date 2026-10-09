import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

import { emailedLink } from "./outbox";

export const PASSWORD = "e2e-journey-password";

export type E2eServer = { origin: string; dir: string };
const MAIN_SERVER: E2eServer = { origin: "", dir: ".e2e" };

export async function submitSignUp(page: Page) {
  await expect(async () => {
    if (!/\/verify-email$/.test(page.url())) {
      await page.getByRole("button", { name: "Create account" }).click({ timeout: 1000 });
    }
    await expect(page).toHaveURL(/\/verify-email$/, { timeout: 3000 });
  }).toPass({ timeout: 25_000 });
}

export async function createVerifiedAccount(page: Page, prefix = "e2e", server = MAIN_SERVER) {
  const email = `${prefix}-${Date.now()}@example.com`;

  await page.goto(`${server.origin}/sign-up`);
  await page.getByLabel("Name").fill("Ada");
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(PASSWORD);
  await submitSignUp(page);

  await page.goto(await emailedLink(email, "Verify your email", server.dir));
  await expect(page).toHaveURL(/\/dashboard$/);

  return email;
}
