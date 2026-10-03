import { expect, test, type Locator, type Page } from "@playwright/test";

// The rest of the suite runs with reduced motion so scans see final-state content; the first describe
// lets arrival animations play, to prove they always end with the content visible, and the second
// proves that with reduced motion the final state is there at once.

// CSS opacity is not inherited but it does compound, so a wrapper that is stuck half-faded dims
// everything inside it. Multiply up the tree to get what the visitor actually sees.
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
  page.getByText("Fig. 1 — the promise"),
  page.getByText("Next.js, MongoDB and authentication"),
];

test.describe("with motion", () => {
  test.use({ reducedMotion: "no-preference" });

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

    await expectArrived(page.getByText("Next.js, MongoDB and authentication"));
  });
});

test.describe("with reduced motion", () => {
  test.use({ reducedMotion: "reduce" });

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
