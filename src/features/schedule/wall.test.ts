import { describe, expect, it } from "vitest";

import type { ScheduleDay, ScheduleEntry } from "./service";
import { posterWall } from "./wall";

const NOW = new Date("2026-10-03T12:00:00Z");

function entry(showRoute: string, airAt: string, overrides: Partial<ScheduleEntry> = {}) {
  return {
    showRoute,
    title: showRoute,
    coverUrl: null,
    episodeNumber: 1,
    firstEpisodeNumber: null,
    airAt: new Date(airAt).toISOString(),
    delayed: false,
    delayedText: null,
    ...overrides,
  } satisfies ScheduleEntry;
}

const WEEK: ScheduleDay[] = [
  {
    day: "2026-10-03",
    entries: [
      entry("morning", "2026-10-03T01:00:00Z"),
      entry("noon", "2026-10-03T12:00:00Z"),
      entry("evening", "2026-10-03T15:30:00Z"),
      entry("late", "2026-10-03T17:30:00Z"),
    ],
  },
  { day: "2026-10-04", entries: [entry("tomorrow", "2026-10-04T13:00:00Z")] },
  { day: "2026-10-05", entries: [] },
];

const routes = (entries: readonly ScheduleEntry[]) => entries.map((item) => item.showRoute);

describe("posterWall", () => {
  it("picks the first episode after now as up next", () => {
    expect(posterWall(WEEK, NOW, new Set()).upNext?.showRoute).toBe("evening");
  });

  it("counts an episode as aired from its air instant on, not a moment before", () => {
    const atNoon = posterWall(WEEK, NOW, new Set());
    const justBefore = posterWall(WEEK, new Date(NOW.getTime() - 1), new Set());

    expect(routes(atNoon.days[0]?.entries.filter((item) => item.aired) ?? [])).toEqual([
      "morning",
      "noon",
    ]);
    expect(routes(justBefore.days[0]?.entries.filter((item) => item.aired) ?? [])).toEqual([
      "morning",
    ]);
    expect(justBefore.upNext?.showRoute).toBe("noon");
  });

  it("counts what today has left and what already aired", () => {
    expect(posterWall(WEEK, NOW, new Set()).today).toEqual({
      day: "2026-10-03",
      aired: 2,
      remaining: 2,
      delayed: 0,
    });
  });

  it("falls through to a later day once today is finished", () => {
    const wall = posterWall(WEEK, new Date("2026-10-03T18:00:00Z"), new Set());

    expect(wall.upNext?.showRoute).toBe("tomorrow");
    expect(wall.today).toMatchObject({ day: "2026-10-03", aired: 4, remaining: 0 });
  });

  it("has nothing up next once the week is finished", () => {
    const wall = posterWall(WEEK, new Date("2026-10-06T00:00:00Z"), new Set());

    expect(wall.upNext).toBeNull();
    expect(wall.today).toEqual({ day: "2026-10-06", aired: 0, remaining: 0, delayed: 0 });
    expect(wall.days.flatMap((day) => day.entries).every((item) => item.aired)).toBe(true);
  });

  it("never offers a delayed episode as up next, and never calls it aired", () => {
    const week: ScheduleDay[] = [
      {
        day: "2026-10-03",
        entries: [
          entry("held-back", "2026-10-03T01:00:00Z", { delayed: true }),
          entry("postponed", "2026-10-03T13:00:00Z", { delayed: true }),
          entry("on-time", "2026-10-03T14:00:00Z"),
        ],
      },
    ];

    const wall = posterWall(week, NOW, new Set());

    expect(wall.upNext?.showRoute).toBe("on-time");
    expect(wall.days[0]?.entries.map((item) => item.aired)).toEqual([false, false, false]);
    expect(wall.today).toMatchObject({ aired: 0, remaining: 1, delayed: 2 });
  });

  it("marks the shows the user follows, and keeps days and order as given", () => {
    const wall = posterWall(WEEK, NOW, new Set(["late", "tomorrow"]));

    expect(wall.days.map((day) => [day.day, routes(day.entries)])).toEqual([
      ["2026-10-03", ["morning", "noon", "evening", "late"]],
      ["2026-10-04", ["tomorrow"]],
      ["2026-10-05", []],
    ]);
    expect(routes(wall.days.flatMap((day) => day.entries).filter((item) => item.followed))).toEqual(
      ["late", "tomorrow"],
    );
    expect(wall.upNext?.followed).toBe(false);
  });

  it("counts today by the schedule day of now, wherever that day sits in the week", () => {
    const wall = posterWall([...WEEK].reverse(), NOW, new Set());

    expect(wall.today).toMatchObject({ day: "2026-10-03", aired: 2, remaining: 2 });
  });

  it("is empty-handed but whole for a week with no days", () => {
    expect(posterWall([], NOW, new Set())).toEqual({
      days: [],
      upNext: null,
      today: { day: "2026-10-03", aired: 0, remaining: 0, delayed: 0 },
    });
  });
});
