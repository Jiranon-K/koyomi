import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { ScheduleSourceError, type ScheduleSource } from "./source";
import { runScheduleSync, scheduleSource } from "./sync";

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (load: unknown) => load,
}));

const NOW = new Date("2026-10-03T05:00:00Z");
const saved = { ...process.env };

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("schedule-sync-test");
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(() => {
  mocks.revalidateTag.mockClear();
  delete process.env.USE_FAKES;
  delete process.env.ANIMESCHEDULE_TOKEN;
});

describe("scheduleSource", () => {
  it("is the fake when USE_FAKES is true", async () => {
    process.env.USE_FAKES = "true";

    const source = scheduleSource();

    expect(source.name).toBe("fake");
    expect((await source.fetchTimetable(NOW)).episodes.length).toBeGreaterThan(0);
  });

  it("is AnimeSchedule otherwise, and a missing token fails the fetch by name", async () => {
    const source = scheduleSource();

    expect(source.name).toBe("animeschedule");
    await expect(source.fetchTimetable(NOW)).rejects.toThrow(/ANIMESCHEDULE_TOKEN is not set/);
  });
});

describe("runScheduleSync", () => {
  it("expires the cached schedule when the sync succeeds", async () => {
    process.env.USE_FAKES = "true";

    const run = await runScheduleSync(scheduleSource(), NOW);

    expect(run).toMatchObject({ outcome: "success", source: "fake" });
    expect(mocks.revalidateTag).toHaveBeenCalledExactlyOnceWith("schedule", { expire: 0 });
  });

  it("leaves the cache alone when the sync fails", async () => {
    const limited: ScheduleSource = {
      name: "animeschedule",
      fetchTimetable: async () => {
        throw new ScheduleSourceError("rate-limited", "AnimeSchedule rate limit reached (429).");
      },
    };

    const run = await runScheduleSync(limited, NOW);

    expect(run.outcome).toBe("failure");
    expect(mocks.revalidateTag).not.toHaveBeenCalled();
  });

  it("records a missing token as a failed run instead of throwing", async () => {
    const run = await runScheduleSync(scheduleSource(), NOW);

    expect(run).toMatchObject({ outcome: "failure", source: "animeschedule" });
    expect(run.error).toMatch(/ANIMESCHEDULE_TOKEN is not set/);
  });
});
