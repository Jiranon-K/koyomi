import { beforeEach, describe, expect, it, vi } from "vitest";

import { setDashboardViewAction } from "./actions";

const mocks = vi.hoisted(() => ({
  userId: null as string | null,
  setDashboardView: vi.fn(async () => undefined),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/session", () => ({
  requireSession: async () => {
    if (!mocks.userId) throw new Error("REDIRECT /sign-in");
    return { user: { id: mocks.userId } };
  },
}));

vi.mock("./service", () => ({ setDashboardView: mocks.setDashboardView }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

const IDLE = { error: null };

function form(view?: string | File): FormData {
  const data = new FormData();
  if (view !== undefined) data.set("view", view);
  return data;
}

beforeEach(() => {
  mocks.userId = "user-ada";
  vi.clearAllMocks();
});

describe("setDashboardViewAction", () => {
  it("sends a signed-out caller to sign-in before doing anything", async () => {
    mocks.userId = null;

    await expect(setDashboardViewAction(IDLE, form("index"))).rejects.toThrow("REDIRECT /sign-in");
    expect(mocks.setDashboardView).not.toHaveBeenCalled();
  });

  it.each(["feature", "index"])("stores %s for the signed-in user and refreshes", async (view) => {
    expect(await setDashboardViewAction(IDLE, form(view))).toEqual({ error: null });

    expect(mocks.setDashboardView).toHaveBeenCalledExactlyOnceWith("user-ada", view);
    expect(mocks.revalidatePath.mock.calls).toEqual([["/settings"], ["/dashboard"]]);
  });

  it.each([
    ["a missing view", form()],
    ["an unknown view", form("ribbon")],
    ["a view that is a file", form(new File(["x"], "x.txt"))],
  ])("refuses %s", async (_case, data) => {
    expect((await setDashboardViewAction(IDLE, data)).error).toMatch(/try again/);

    expect(mocks.setDashboardView).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });
});
