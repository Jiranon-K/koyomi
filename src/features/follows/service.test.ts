import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { dayWindowOf } from "@/features/schedule/day-window";
import { createFakeSource } from "@/features/schedule/fake-source";
import { Episode, Show, SyncRun } from "@/features/schedule/model";
import { syncSchedule } from "@/features/schedule/service";

import { Follow } from "./model";
import {
  followedEpisodesBetween,
  followedRoutes,
  followShow,
  myWeek,
  unfollowShow,
} from "./service";

// Saturday 3 October 2026, 12:00 in Bangkok.
const NOW = new Date("2026-10-03T05:00:00Z");
const ADA = "user-ada";
const BOB = "user-bob";
const saved = { ...process.env };

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("follows-test");
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await syncSchedule(createFakeSource(), NOW); // connects
  await Promise.all([
    Follow.deleteMany({}),
    Show.deleteMany({}),
    Episode.deleteMany({}),
    SyncRun.deleteMany({}),
  ]);
  await syncSchedule(createFakeSource(), NOW);
});

describe("followShow", () => {
  it("follows a show the schedule knows", async () => {
    expect(await followShow(ADA, "lantern-street-diaries")).toBe("followed");

    expect(await followedRoutes(ADA)).toEqual(["lantern-street-diaries"]);
  });

  it("leaves one follow when the same show is followed twice, even at the same moment", async () => {
    await Promise.all([
      followShow(ADA, "lantern-street-diaries"),
      followShow(ADA, "lantern-street-diaries"),
      followShow(ADA, "lantern-street-diaries"),
    ]);
    expect(await followShow(ADA, "lantern-street-diaries")).toBe("followed");

    expect(await Follow.countDocuments({ userId: ADA })).toBe(1);
  });

  it("enforces one follow per user and show with a unique index", async () => {
    expect(await Follow.collection.indexes()).toContainEqual(
      expect.objectContaining({ key: { userId: 1, showRoute: 1 }, unique: true }),
    );
    await Follow.create({ userId: ADA, showRoute: "lantern-street-diaries", createdAt: NOW });

    await expect(
      Follow.create({ userId: ADA, showRoute: "lantern-street-diaries", createdAt: NOW }),
    ).rejects.toMatchObject({ code: 11000 });
  });

  it("refuses a show the schedule does not know", async () => {
    expect(await followShow(ADA, "no-such-show")).toBe("unknown-show");

    expect(await followedRoutes(ADA)).toEqual([]);
  });
});

describe("unfollowShow", () => {
  it("removes the follow and is harmless when there is none", async () => {
    await followShow(ADA, "lantern-street-diaries");

    await unfollowShow(ADA, "lantern-street-diaries");
    await unfollowShow(ADA, "lantern-street-diaries");

    expect(await followedRoutes(ADA)).toEqual([]);
  });
});

describe("one user's follows are invisible to another", () => {
  beforeEach(async () => {
    await followShow(ADA, "lantern-street-diaries");
    await followShow(ADA, "harbor-of-paper-cranes");
    await followShow(BOB, "clockwork-orchard");
  });

  it("lists only the user's own routes", async () => {
    expect(await followedRoutes(ADA)).toEqual(["harbor-of-paper-cranes", "lantern-street-diaries"]);
    expect(await followedRoutes(BOB)).toEqual(["clockwork-orchard"]);
    expect(await followedRoutes("user-nobody")).toEqual([]);
  });

  it("returns only the user's own episodes in a window", async () => {
    const today = dayWindowOf(NOW);

    const ada = await followedEpisodesBetween(ADA, today.start, today.end);
    const bob = await followedEpisodesBetween(BOB, today.start, today.end);
    const nobody = await followedEpisodesBetween("user-nobody", today.start, today.end);

    expect(ada.map((entry) => entry.showRoute)).toEqual(["lantern-street-diaries"]);
    expect(bob.map((entry) => entry.showRoute)).toEqual(["clockwork-orchard"]);
    expect(nobody).toEqual([]);
  });

  it("builds each user's week and lists from their own follows", async () => {
    const ada = await myWeek(ADA, NOW);
    const bob = await myWeek(BOB, NOW);

    expect(ada.following.map((show) => show.route)).toEqual(["lantern-street-diaries"]);
    expect(ada.finished.map((show) => show.route)).toEqual(["harbor-of-paper-cranes"]);
    expect(bob.following.map((show) => show.route)).toEqual(["clockwork-orchard"]);
    expect(bob.finished).toEqual([]);
  });

  it("unfollowing one user's show leaves the other user's follow of it alone", async () => {
    await followShow(BOB, "lantern-street-diaries");

    await unfollowShow(ADA, "lantern-street-diaries");

    expect(await followedRoutes(BOB)).toContain("lantern-street-diaries");
  });
});

describe("myWeek", () => {
  it("groups the followed episodes by the same Bangkok schedule day as the public page", async () => {
    await followShow(ADA, "clockwork-orchard"); // 00:30 after midnight: still Saturday night
    await followShow(ADA, "moss-and-thunder"); // 05:00 on the dot: the start of Friday
    await followShow(ADA, "salt-and-starlight");

    const week = await myWeek(ADA, NOW);

    expect(week.days.map((day) => [day.day, day.entries.map((entry) => entry.showRoute)])).toEqual([
      ["2026-10-03", ["clockwork-orchard"]],
      ["2026-10-04", ["salt-and-starlight"]],
      ["2026-10-05", []],
      ["2026-10-06", []],
      ["2026-10-07", []],
      ["2026-10-08", []],
      ["2026-10-09", ["moss-and-thunder"]],
    ]);
    expect(week.days[1]?.entries[0]?.delayed).toBe(true);
  });

  it("is empty for a user who follows nothing", async () => {
    const week = await myWeek(ADA, NOW);

    expect(week.following).toEqual([]);
    expect(week.finished).toEqual([]);
    expect(week.days.every((day) => day.entries.length === 0)).toBe(true);
  });

  it("puts a finished show under finished, with its title, and not in the week", async () => {
    await followShow(ADA, "harbor-of-paper-cranes");

    const week = await myWeek(ADA, NOW);

    expect(week.finished).toEqual([
      { route: "harbor-of-paper-cranes", title: "Harbor of Paper Cranes" },
    ]);
    expect(week.following).toEqual([]);
    expect(week.days.every((day) => day.entries.length === 0)).toBe(true);
  });

  it("keeps a finished show in the week while its last episode is still to come", async () => {
    await followShow(ADA, "lantern-street-diaries");
    await Show.updateOne({ route: "lantern-street-diaries" }, { $set: { status: "finished" } });

    const week = await myWeek(ADA, NOW);

    expect(week.following.map((show) => show.route)).toEqual(["lantern-street-diaries"]);
    expect(week.finished).toEqual([]);
    expect(week.days[0]?.entries.map((entry) => entry.showRoute)).toEqual([
      "lantern-street-diaries",
    ]);
  });

  it("treats a show that dropped out of the timetable as finished", async () => {
    await followShow(ADA, "the-ninth-platform");
    // A later sync no longer lists the show, and its episodes have aired.
    const later = new Date(NOW.getTime() + 14 * 24 * 60 * 60 * 1000);
    await syncSchedule(
      { name: "fake", fetchTimetable: async () => ({ episodes: [], requests: 0, skipped: 0 }) },
      later,
    );

    const week = await myWeek(ADA, later);

    expect(week.finished.map((show) => show.route)).toEqual(["the-ninth-platform"]);
    expect(week.following).toEqual([]);
  });

  it("keeps the finished follow after its episodes have expired", async () => {
    await followShow(ADA, "harbor-of-paper-cranes");
    await Episode.deleteMany({ showRoute: "harbor-of-paper-cranes" });

    expect((await myWeek(ADA, NOW)).finished.map((show) => show.route)).toEqual([
      "harbor-of-paper-cranes",
    ]);
  });
});
