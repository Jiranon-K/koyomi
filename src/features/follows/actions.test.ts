import { beforeEach, describe, expect, it, vi } from "vitest";

import { followAction, unfollowAction } from "./actions";

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  followShow: vi.fn(async () => "followed" as const),
  unfollowShow: vi.fn(async () => undefined),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/session", () => ({
  requireSession: async () => {
    if (!mocks.userId) throw new Error("REDIRECT /sign-in");
    return { user: { id: mocks.userId } };
  },
}));

vi.mock("./service", () => ({ followShow: mocks.followShow, unfollowShow: mocks.unfollowShow }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

function form(showRoute?: string | File): FormData {
  const data = new FormData();
  if (showRoute !== undefined) data.set("showRoute", showRoute);
  return data;
}

beforeEach(() => {
  mocks.userId = "user-ada";
  vi.clearAllMocks();
});

describe.each([
  ["followAction", followAction, mocks.followShow],
  ["unfollowAction", unfollowAction, mocks.unfollowShow],
])("%s", (_name, action, service) => {
  it("sends a signed-out caller to sign-in before doing anything", async () => {
    mocks.userId = null;

    await expect(action(form("lantern-street-diaries"))).rejects.toThrow("REDIRECT /sign-in");
    expect(service).not.toHaveBeenCalled();
  });

  it("acts for the signed-in user only, then refreshes both pages", async () => {
    await action(form("  lantern-street-diaries "));

    expect(service).toHaveBeenCalledExactlyOnceWith("user-ada", "lantern-street-diaries");
    expect(mocks.revalidatePath.mock.calls).toEqual([["/schedule"], ["/dashboard"]]);
  });

  it.each([
    ["a missing show", form()],
    ["an empty show", form("  ")],
    ["a show that is a file", form(new File(["x"], "x.txt"))],
    ["an overlong show", form("a".repeat(201))],
  ])("ignores %s", async (_case, data) => {
    await action(data);

    expect(service).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
