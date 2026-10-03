import { describe, expect, it } from "vitest";

import { safeReturnPath, signInPathReturningTo } from "./paths";

describe("safeReturnPath", () => {
  it("keeps a path on this site, with its query and fragment", () => {
    expect(safeReturnPath("/schedule")).toBe("/schedule");
    expect(safeReturnPath("/schedule?day=2026-10-03#today")).toBe("/schedule?day=2026-10-03#today");
  });

  it("falls back to the dashboard when there is nothing to return to", () => {
    expect(safeReturnPath(undefined)).toBe("/dashboard");
    expect(safeReturnPath("")).toBe("/dashboard");
    expect(safeReturnPath(["/schedule", "/other"])).toBe("/dashboard");
  });

  it.each([
    "https://evil.example/schedule",
    "//evil.example",
    "/\\evil.example",
    "\\\\evil.example",
    "/\t/evil.example",
    "/.//evil.example",
    "/%2e//evil.example",
    "javascript:alert(1)",
    "schedule",
    " /schedule",
  ])("refuses %j, which could leave the site", (value) => {
    expect(safeReturnPath(value)).toBe("/dashboard");
  });
});

describe("signInPathReturningTo", () => {
  it("builds a sign-in link that safeReturnPath reads back", () => {
    const link = signInPathReturningTo("/schedule");

    expect(link).toBe("/sign-in?next=%2Fschedule");
    expect(safeReturnPath(new URL(link, "http://localhost").searchParams.get("next"))).toBe(
      "/schedule",
    );
  });
});
