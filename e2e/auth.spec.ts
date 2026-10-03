import { expect, test, type Page } from "@playwright/test";

import { createVerifiedAccount, PASSWORD as password } from "./account";
import { seriousViolations } from "./axe";
import { followBehindTheServer, syncSchedule } from "./schedule";

async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(page).toHaveURL(/\/sign-in$/);
}

test("a signed-out visitor to the dashboard is sent to sign-in", async ({ page }) => {
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);
});

test("sign up, verify, follow a show from the schedule, see my week and unfollow", async ({
  page,
}) => {
  const lantern = "Lantern Street Diaries";
  const harbor = "Harbor of Paper Cranes";
  await syncSchedule(page.request, "base");

  const email = await createVerifiedAccount(page);
  await expect(page.getByText(email)).toBeVisible();
  await expect(page.getByText("You are not following any shows yet.")).toBeVisible();

  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toContainClass("dark");
  expect(await seriousViolations(page)).toEqual([]);

  await signOut(page);
  await page.goto("/dashboard");
  await expect(page).toHaveURL(/\/sign-in$/);

  await page.goto("/schedule");
  await page.getByRole("link", { name: `Follow ${lantern}` }).click();
  await expect(page).toHaveURL(/\/sign-in\?next=%2Fschedule$/);
  await page.getByLabel("Email address").fill(email);
  await page.getByLabel("Password", { exact: true }).fill(password);
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await expect(page).toHaveURL(/\/schedule$/);

  await page.getByRole("button", { name: `Follow ${lantern}` }).click();
  await expect(page.getByRole("button", { name: `Unfollow ${lantern}` })).toBeVisible();
  await followBehindTheServer(email, "harbor-of-paper-cranes");

  await page.getByRole("link", { name: "My week" }).click();
  await expect(page).toHaveURL(/\/dashboard$/);
  const today = page.getByRole("region").first();
  await expect(today.getByText("Today")).toBeVisible();
  await expect(today.getByRole("listitem")).toHaveText([
    /22:30.*Lantern Street Diaries.*Episode 5/,
  ]);
  await expect(page.getByText("Clockwork Orchard")).toHaveCount(0);
  await expect(page.getByRole("region", { name: "Following" }).getByRole("listitem")).toHaveText([
    new RegExp(lantern),
  ]);
  await expect(page.getByRole("region", { name: "Finished" }).getByRole("listitem")).toHaveText([
    new RegExp(harbor),
  ]);

  expect(await seriousViolations(page)).toEqual([]);
  await page.getByRole("button", { name: "Toggle theme" }).click();
  await expect(page.locator("html")).toContainClass("light");
  expect(await seriousViolations(page)).toEqual([]);

  await page.goto("/sign-in?next=https://example.com/steal");
  await expect(page).toHaveURL(/\/dashboard$/);
  await page.goto("/sign-in?next=//example.com");
  await expect(page).toHaveURL(/\/dashboard$/);

  await page.getByRole("button", { name: `Unfollow ${lantern}` }).click();
  await expect(page.getByText("None of your shows air in the next seven days.")).toBeVisible();
  await expect(page.getByRole("region", { name: "Following" })).toHaveCount(0);
  await page.getByRole("button", { name: `Unfollow ${harbor}` }).click();
  await expect(page.getByText("You are not following any shows yet.")).toBeVisible();

  await page.getByRole("link", { name: "Browse the schedule" }).click();
  await expect(page).toHaveURL(/\/schedule$/);
  await expect(page.getByRole("button", { name: `Follow ${lantern}` })).toBeVisible();
  await page.getByRole("link", { name: "My week" }).click();

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
    "/schedule",
  ]) {
    test(`${path} has no serious accessibility violations in the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((stored) => {
        window.localStorage.setItem("theme", stored);
      }, theme);
      if (path === "/schedule") await syncSchedule(page.request, "base");
      await page.goto(path);
      await expect(page.locator("html")).toContainClass(theme);

      expect(await seriousViolations(page)).toEqual([]);
    });
  }
}
