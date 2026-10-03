import { beforeEach, describe, expect, it, vi } from "vitest";

import type { SyncRunDoc } from "@/features/schedule/model";

import { syncNowAction } from "./actions";

const TOKEN = "animeschedule-token-value";

function run(overrides: Partial<SyncRunDoc> = {}): SyncRunDoc {
  return {
    startedAt: new Date("2026-10-03T02:00:00Z"),
    finishedAt: new Date("2026-10-03T02:00:01Z"),
    outcome: "success",
    source: "fake",
    requests: 2,
    shows: 6,
    episodes: 7,
    skipped: 0,
    error: null,
    ...overrides,
  };
}

const mocks = vi.hoisted(() => ({
  role: null as "user" | "admin" | null,
  runScheduleSync: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("@/features/auth/session", () => ({
  requireAdmin: async () => {
    if (!mocks.role) throw new Error("REDIRECT /sign-in");
    if (mocks.role !== "admin") throw new Error("NOT_FOUND");
    return { user: { id: "user-owner", role: mocks.role } };
  },
}));

vi.mock("@/features/schedule/sync", () => ({ runScheduleSync: mocks.runScheduleSync }));

vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.role = "admin";
  mocks.runScheduleSync.mockResolvedValue(run());
});

describe("syncNowAction", () => {
  it("sends a signed-out caller to sign-in before doing anything", async () => {
    mocks.role = null;

    await expect(syncNowAction()).rejects.toThrow("REDIRECT /sign-in");
    expect(mocks.runScheduleSync).not.toHaveBeenCalled();
  });

  it("refuses a regular user before doing anything", async () => {
    mocks.role = "user";

    await expect(syncNowAction()).rejects.toThrow("NOT_FOUND");
    expect(mocks.runScheduleSync).not.toHaveBeenCalled();
    expect(mocks.revalidatePath).not.toHaveBeenCalled();
  });

  it("runs the sync for an admin, refreshes the page and says what was stored", async () => {
    const state = await syncNowAction();

    expect(mocks.runScheduleSync).toHaveBeenCalledExactlyOnceWith();
    expect(mocks.revalidatePath.mock.calls).toEqual([["/admin"]]);
    expect(state).toEqual({ error: null, notice: "Synced: 7 episodes of 6 shows." });
  });

  it("reports a failed sync and still refreshes the page, which shows the reason", async () => {
    mocks.runScheduleSync.mockResolvedValue(
      run({ outcome: "failure", error: "AnimeSchedule rate limit reached (429)." }),
    );

    const state = await syncNowAction();

    expect(state).toEqual({
      error: "The sync failed. The reason is recorded above.",
      notice: null,
    });
    expect(mocks.revalidatePath.mock.calls).toEqual([["/admin"]]);
  });

  it("reports a sync that could not even be recorded, without the cause", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    mocks.runScheduleSync.mockRejectedValue(new Error(`database down, Bearer ${TOKEN}`));

    const state = await syncNowAction();

    expect(state).toEqual({ error: "The sync could not run. Please try again.", notice: null });
    expect(JSON.stringify(state)).not.toContain(TOKEN);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
