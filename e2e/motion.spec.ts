import { expect, test, type Locator, type Page } from "@playwright/test";

import { createVerifiedAccount } from "./account";
import { syncSchedule } from "./schedule";
import { makeAdmin } from "./seed";

function effectiveOpacity(locator: Locator) {
  return locator.evaluate((el) => {
    let opacity = 1;
    for (let node: Element | null = el; node; node = node.parentElement) {
      opacity *= Number(getComputedStyle(node).opacity);
    }
    return opacity;
  });
}

async function expectArrived(locator: Locator) {
  await expect(locator).toBeVisible();
  await expect.poll(() => effectiveOpacity(locator)).toBeCloseTo(1, 3);
}

const landingText = (page: Page) => [
  page.getByRole("heading", { level: 1 }),
  page.getByText("Fig. 1 — the reminder"),
  page.getByText("The season's airing schedule in Thai time"),
];

async function wrongPassword(page: Page) {
  await page.goto("/sign-in");
  await page.getByLabel("Email address").fill(`e2e-motion-${Date.now()}@example.com`);
  await page.getByLabel("Password", { exact: true }).fill("not-the-password");
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  return {
    alert: page.getByRole("alert").filter({ hasText: "Invalid email or password." }),
    text: page.getByText("Invalid email or password."),
  };
}

function scaleOf(locator: Locator) {
  return locator.evaluate((el) => {
    const { transform } = getComputedStyle(el);
    return transform === "none" ? 1 : new DOMMatrixReadOnly(transform).a;
  });
}

const dashboardText = (page: Page, email: string) => [
  page.getByRole("heading", { level: 1, name: "My week" }),
  page.getByText(email),
  page.getByText("You are not following any shows yet."),
  page.getByRole("link", { name: "Browse the schedule" }),
];

const AUTH_PAGES = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/verify-email",
  "/reset-password?token=e2e",
];

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

  for (const path of AUTH_PAGES) {
    test(`${path} arrives with its title and form at full opacity`, async ({ page }) => {
      await page.goto(path);

      await expectArrived(page.getByRole("heading", { level: 1 }));
      await expectArrived(page.locator("main button[type=submit]"));
    });
  }

  test("the dashboard title and empty state arrive at full opacity", async ({ page }) => {
    const email = await createVerifiedAccount(page, "e2e-motion");

    for (const text of dashboardText(page, email)) {
      await expectArrived(text);
    }
  });

  test("the admin title and status rows arrive at full opacity", async ({ page }) => {
    await makeAdmin(await createVerifiedAccount(page, "e2e-motion-admin"));
    await page.goto("/admin");

    await expectArrived(page.getByRole("heading", { level: 1, name: "Status" }));
    await expectArrived(page.getByText("What the background work last did"));
    await expectArrived(page.getByRole("button", { name: "Sync now" }));
    await expectArrived(page.getByText("Users with reminders switched on."));
  });

  test("the schedule title arrives at full opacity and the wall under it is not held back", async ({
    page,
  }) => {
    await syncSchedule(page.request, "base");
    await page.goto("/schedule");

    await expectArrived(page.getByRole("heading", { level: 1, name: "On air this week" }));
    await expectArrived(page.getByRole("listitem").getByText("Lantern Street Diaries"));
    await expectArrived(page.getByRole("group", { name: "Up next" }));
    await expectArrived(page.getByRole("heading", { level: 2 }).last());
  });

  for (const theme of ["light", "dark"]) {
    test(`buttons and the theme toggle shrink slightly while pressed in the ${theme} theme`, async ({
      page,
    }) => {
      await page.addInitScript((stored) => window.localStorage.setItem("theme", stored), theme);
      await page.goto("/sign-in");
      const submit = page.getByRole("button", { name: "Sign in", exact: true });
      const toggle = page.getByRole("button", { name: "Toggle theme" });

      for (const control of [submit, toggle]) {
        await control.hover();
        await page.mouse.down();
        await expect.poll(() => scaleOf(control)).toBeCloseTo(0.98, 2);
        await page.mouse.up();
        await expect.poll(() => scaleOf(control)).toBeCloseTo(1, 3);
      }
    });
  }

  test("a link styled as a button shrinks while pressed too", async ({ page }) => {
    await page.goto("/");
    const link = page.getByRole("link", { name: "Sign in" });

    await link.hover();
    await page.mouse.down();
    await expect.poll(() => scaleOf(link)).toBeCloseTo(0.98, 2);
    await page.mouse.up();
    await expect(page).toHaveURL(/\/sign-in$/);
  });

  test("a sign-in error is announced as an alert and unfolds to full opacity", async ({ page }) => {
    const { alert, text } = await wrongPassword(page);

    await expect(alert).toBeVisible();
    await expectArrived(text);
  });

  test("the landing text is visible at full opacity once the arrival has played", async ({
    page,
  }) => {
    await page.goto("/");

    for (const text of landingText(page)) {
      await expectArrived(text);
    }
  });
});

test.describe("with motion in a tall window", () => {
  test.use({ reducedMotion: "no-preference", viewport: { width: 1580, height: 1233 } });

  test("text in the last tenth of a page that cannot scroll still arrives", async ({ page }) => {
    await page.goto("/");

    await expectArrived(page.getByText("The season's airing schedule in Thai time"));
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

  test("the dashboard title and empty state are at full opacity at once", async ({ page }) => {
    const email = await createVerifiedAccount(page, "e2e-motion");

    for (const text of dashboardText(page, email)) {
      await expect(text).toBeVisible();
      expect(await effectiveOpacity(text)).toBe(1);
    }
  });

  test("a pressed button does not scale", async ({ page }) => {
    await page.goto("/sign-in");
    const submit = page.getByRole("button", { name: "Sign in", exact: true });

    await submit.hover();
    await page.mouse.down();
    await page.waitForTimeout(400);
    expect(await scaleOf(submit)).toBe(1);
    await page.mouse.up();
  });

  test("a sign-in error is at full opacity at once", async ({ page }) => {
    const { alert, text } = await wrongPassword(page);

    await expect(alert).toBeVisible();
    expect(await effectiveOpacity(text)).toBe(1);
  });

  test("the landing text is at full opacity at once, without waiting for an arrival", async ({
    page,
  }) => {
    await page.goto("/");

    for (const text of landingText(page)) {
      await expect(text).toBeVisible();
      expect(await effectiveOpacity(text)).toBe(1);
    }
  });
});
