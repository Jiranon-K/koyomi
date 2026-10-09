import { describe, expect, it } from "vitest";

import { branchProblem, messageProblem, titleProblem } from "./git-conventions";

describe("titleProblem", () => {
  it.each([
    "feat: add a month view",
    "feat(schedule): add a month view",
    "fix(line-login): keep the return path",
    "feat(auth)!: drop password sign-in",
    "ci: bump the actions group with 2 updates",
    "feat(admin): add the status page (koyomi 07)",
  ])("accepts %s", (title) => {
    expect(titleProblem(title)).toBeNull();
  });

  it.each([
    ["Add a month view", "no type"],
    ["feature: add a month view", "unknown type"],
    ["feat(Schedule): add a month view", "uppercase scope"],
    ["feat:add a month view", "no space after the colon"],
    ["feat: ", "empty summary"],
    ["feat: add a month view.", "full stop"],
    [`feat: ${"a".repeat(100)}`, "too long"],
    ["feat: add a view\n\nbody", "more than one line"],
  ])("refuses %s (%s)", (title) => {
    expect(titleProblem(title)).toEqual(expect.any(String));
  });
});

describe("messageProblem", () => {
  it("reads only the first line of a commit message", () => {
    expect(messageProblem("fix: keep the return path\n\nA body. With anything in it.")).toBeNull();
  });

  it("refuses a first line that is not in the format", () => {
    expect(messageProblem("Keep the return path\n\nfix: not here")).toEqual(expect.any(String));
  });

  it.each([
    "Merge branch 'main' into feat/month-view",
    "Merge remote-tracking branch 'origin/main' into feat/month-view",
    'Revert "feat: add a month view"',
    "fixup! feat: add a month view",
    "squash! feat: add a month view",
  ])("accepts the message git writes itself: %s", (message) => {
    expect(messageProblem(message)).toBeNull();
  });
});

describe("branchProblem", () => {
  it.each([
    "feat/month-view",
    "fix/digest-quota-month",
    "chore/update-next-16.4",
    "dependabot/github_actions/actions-1a2b3c",
  ])("accepts %s", (branch) => {
    expect(branchProblem(branch)).toBeNull();
  });

  it.each([
    ["main", "the protected branch"],
    ["month-view", "no type"],
    ["feature/month-view", "unknown type"],
    ["feat/Month_View", "not kebab-case"],
    ["feat/", "no topic"],
    ["feat/month/view", "nested"],
  ])("refuses %s (%s)", (branch) => {
    expect(branchProblem(branch)).toEqual(expect.any(String));
  });
});
