import { expect, test, type Locator } from "@playwright/test";

// The rest of the suite runs with reduced motion so scans see final-state content; this file is the
// one place that lets arrival animations play, to prove they always end with the content visible.
test.use({ reducedMotion: "no-preference" });

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

test("the landing headline is visible at full opacity once the arrival has played", async ({
  page,
}) => {
  await page.goto("/");

  await expectArrived(page.getByRole("heading", { level: 1 }));
});
