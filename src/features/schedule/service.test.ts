import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { dayWindowOf } from "./day-window";
import { createFakeSource } from "./fake-source";
import { Episode, Show, SyncRun } from "./model";
import { episodesBetween, lastSyncRun, syncSchedule, weekSchedule } from "./service";
import { ScheduleSourceError, type ScheduleSource, type SourceEpisode } from "./source";

// Saturday 3 October 2026, 12:00 in Bangkok.
const NOW = new Date("2026-10-03T05:00:00Z");
const saved = { ...process.env };

let server: MongoMemoryServer;

function episode(overrides: Partial<SourceEpisode> & { route?: string } = {}): SourceEpisode {
  const { route = "lantern-street-diaries", ...rest } = overrides;
  return {
    show: { route, title: "Lantern Street Diaries", status: "ongoing", totalEpisodes: 12 },
    episodeNumber: 5,
    firstEpisodeNumber: null,
    airAt: new Date("2026-10-03T15:30:00Z"),
    delayed: false,
    delayedText: null,
    ...rest,
  };
}

function sourceOf(episodes: SourceEpisode[], requests = 2): ScheduleSource {
  return {
    name: "animeschedule",
    fetchTimetable: async () => ({ episodes, requests, skipped: 0 }),
  };
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("schedule-test");
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await syncSchedule(sourceOf([]), NOW); // connects
  await Promise.all([Show.deleteMany({}), Episode.deleteMany({}), SyncRun.deleteMany({})]);
});

describe("syncSchedule", () => {
  it("stores shows and episodes with UTC air times and records a successful run", async () => {
    const run = await syncSchedule(sourceOf([episode()]), NOW);

    expect(run).toMatchObject({
      outcome: "success",
      source: "animeschedule",
      requests: 2,
      shows: 1,
      episodes: 1,
      error: null,
    });
    expect(run.startedAt).toEqual(NOW);
    const show = await Show.findOne({ route: "lantern-street-diaries" }).lean();
    expect(show).toMatchObject({ title: "Lantern Street Diaries", status: "ongoing" });
    expect(show?.lastSeenAt).toEqual(NOW);
    const stored = await Episode.findOne({ showRoute: "lantern-street-diaries" }).lean();
    expect(stored?.airAt.toISOString()).toBe("2026-10-03T15:30:00.000Z");
    expect(await SyncRun.countDocuments()).toBe(1);
  });

  it("updates an episode in place when the source moves or delays it", async () => {
    await syncSchedule(sourceOf([episode()]), NOW);
    await syncSchedule(
      sourceOf([
        episode({
          airAt: new Date("2026-10-10T15:30:00Z"),
          delayed: true,
          delayedText: "Delayed one week",
        }),
      ]),
      NOW,
    );

    const stored = await Episode.find({}).lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]).toMatchObject({ delayed: true, delayedText: "Delayed one week" });
    expect(stored[0]?.airAt.toISOString()).toBe("2026-10-10T15:30:00.000Z");
    expect(await Show.countDocuments()).toBe(1);
  });

  it("removes an episode the source no longer lists inside the span it returned", async () => {
    const first = episode({ episodeNumber: 5, airAt: new Date("2026-10-03T15:30:00Z") });
    const dropped = episode({ episodeNumber: 6, airAt: new Date("2026-10-06T15:30:00Z") });
    const last = episode({ episodeNumber: 7, airAt: new Date("2026-10-10T15:30:00Z") });
    const older = episode({ episodeNumber: 4, airAt: new Date("2026-09-26T15:30:00Z") });
    await syncSchedule(sourceOf([older, first, dropped, last]), NOW);

    await syncSchedule(sourceOf([first, last]), new Date(NOW.getTime() + 60_000));

    const numbers = (await Episode.find({}).sort({ episodeNumber: 1 }).lean()).map(
      (stored) => stored.episodeNumber,
    );
    expect(numbers).toEqual([4, 5, 7]);
  });

  it("never moves an episode's sync mark backwards when an older run finishes last", async () => {
    // Two runs can overlap (Sync now beside a scheduled run). If the older one could lower the
    // mark, the newer run's clean-up would delete every row as "not written by this run".
    const later = new Date(NOW.getTime() + 60_000);
    await syncSchedule(sourceOf([episode()]), later);
    await syncSchedule(sourceOf([episode()]), NOW);

    const stored = await Episode.find().lean();
    expect(stored).toHaveLength(1);
    expect(stored[0]?.syncedAt).toEqual(later);
  });

  it("records a failed run and keeps the data when the source is rate-limited", async () => {
    await syncSchedule(sourceOf([episode()]), NOW);
    const limited: ScheduleSource = {
      name: "animeschedule",
      fetchTimetable: async () => {
        throw new ScheduleSourceError("rate-limited", "AnimeSchedule rate limit reached (429).");
      },
    };

    const run = await syncSchedule(limited, new Date(NOW.getTime() + 60_000));

    expect(run).toMatchObject({
      outcome: "failure",
      shows: 0,
      episodes: 0,
      error: "AnimeSchedule rate limit reached (429).",
    });
    expect(await Episode.countDocuments()).toBe(1);
    expect(await SyncRun.countDocuments()).toBe(2);
  });

  it("records a failed run for an unexpected source error too", async () => {
    const broken: ScheduleSource = {
      name: "animeschedule",
      fetchTimetable: async () => {
        throw new TypeError("boom");
      },
    };

    const run = await syncSchedule(broken, NOW);

    expect(run).toMatchObject({ outcome: "failure", error: "boom" });
  });
});

describe("indexes", () => {
  it("expires episodes 30 days after their air time", async () => {
    const indexes = await Episode.collection.indexes();

    expect(indexes).toContainEqual(
      expect.objectContaining({ key: { airAt: 1 }, expireAfterSeconds: 30 * 24 * 60 * 60 }),
    );
  });

  it("keeps one row per show route and per episode of a show", async () => {
    expect(await Show.collection.indexes()).toContainEqual(
      expect.objectContaining({ key: { route: 1 }, unique: true }),
    );
    expect(await Episode.collection.indexes()).toContainEqual(
      expect.objectContaining({ key: { showRoute: 1, episodeNumber: 1 }, unique: true }),
    );
  });
});

describe("lastSyncRun", () => {
  it("is null before any sync", async () => {
    expect(await lastSyncRun()).toBeNull();
  });

  it("returns the latest run, or the latest successful one", async () => {
    const failing: ScheduleSource = {
      name: "animeschedule",
      fetchTimetable: async () => {
        throw new ScheduleSourceError("http", "AnimeSchedule answered 503.");
      },
    };
    await syncSchedule(sourceOf([episode()]), NOW);
    await syncSchedule(failing, new Date(NOW.getTime() + 60_000));

    expect(await lastSyncRun()).toMatchObject({ outcome: "failure" });
    expect(await lastSyncRun("success")).toMatchObject({ outcome: "success", startedAt: NOW });
  });
});

describe("episodesBetween", () => {
  it("returns the episodes of a window with their show title, earliest first", async () => {
    const today = dayWindowOf(NOW);
    await syncSchedule(
      sourceOf([
        episode({ episodeNumber: 1, airAt: new Date(today.start.getTime() - 1) }),
        episode({ episodeNumber: 2, airAt: today.start }),
        episode({ route: "clockwork-orchard", episodeNumber: 3, airAt: new Date(NOW) }),
        episode({ episodeNumber: 4, airAt: new Date(today.end.getTime() - 1) }),
        episode({ episodeNumber: 5, airAt: today.end }),
      ]),
      NOW,
    );

    const entries = await episodesBetween(today.start, today.end);

    expect(entries.map((entry) => [entry.showRoute, entry.episodeNumber])).toEqual([
      ["lantern-street-diaries", 2],
      ["clockwork-orchard", 3],
      ["lantern-street-diaries", 4],
    ]);
    expect(entries[0]).toEqual({
      showRoute: "lantern-street-diaries",
      title: "Lantern Street Diaries",
      episodeNumber: 2,
      firstEpisodeNumber: null,
      airAt: today.start.toISOString(),
      delayed: false,
      delayedText: null,
    });
  });

  it("can be limited to some shows, and to none", async () => {
    const today = dayWindowOf(NOW);
    await syncSchedule(
      sourceOf([episode(), episode({ route: "clockwork-orchard", episodeNumber: 3 })]),
      NOW,
    );

    const some = await episodesBetween(today.start, today.end, ["clockwork-orchard"]);
    const none = await episodesBetween(today.start, today.end, []);

    expect(some.map((entry) => entry.showRoute)).toEqual(["clockwork-orchard"]);
    expect(none).toEqual([]);
  });
});

describe("weekSchedule", () => {
  it("groups seven days of the fake season by Bangkok schedule day", async () => {
    await syncSchedule(createFakeSource(), NOW);

    const week = await weekSchedule(NOW);

    expect(week.lastSyncedAt).toBe(NOW.toISOString());
    expect(week.days.map((day) => [day.day, day.entries.map((entry) => entry.showRoute)])).toEqual([
      // 00:30 on Sunday belongs to Saturday night, after the 22:30 show.
      ["2026-10-03", ["lantern-street-diaries", "clockwork-orchard"]],
      ["2026-10-04", ["salt-and-starlight"]],
      ["2026-10-05", ["the-ninth-platform"]],
      ["2026-10-06", []],
      ["2026-10-07", []],
      ["2026-10-08", []],
      ["2026-10-09", ["moss-and-thunder"]],
    ]);
    expect(week.days[0]?.entries[1]?.airAt).toBe("2026-10-03T17:30:00.000Z");
    expect(week.days[1]?.entries[0]).toMatchObject({
      delayed: true,
      delayedText: "Delayed one week",
    });
  });

  it("shows a newly announced delay after the next sync", async () => {
    await syncSchedule(createFakeSource("base"), NOW);
    await syncSchedule(createFakeSource("revised"), new Date(NOW.getTime() + 60_000));

    const week = await weekSchedule(NOW);

    expect(week.days[2]?.entries[0]).toMatchObject({
      showRoute: "the-ninth-platform",
      delayed: true,
    });
  });

  it("has seven empty days and no sync time before the first sync", async () => {
    const week = await weekSchedule(NOW);

    expect(week.lastSyncedAt).toBeNull();
    expect(week.days).toHaveLength(7);
    expect(week.days.every((day) => day.entries.length === 0)).toBe(true);
  });
});
