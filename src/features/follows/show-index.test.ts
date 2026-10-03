import { describe, expect, it } from "vitest";

import type { ScheduleDay, ScheduleEntry } from "@/features/schedule/service";
import { posterWall } from "@/features/schedule/wall";

import { showIndex } from "./show-index";

const NOW = new Date("2026-10-03T12:00:00Z");

function entry(showRoute: string, airAt: string, delayed = false): ScheduleEntry {
  return {
    showRoute,
    title: showRoute,
    coverUrl: null,
    episodeNumber: 1,
    firstEpisodeNumber: null,
    airAt,
    delayed,
    delayedText: delayed ? "Delayed" : null,
  };
}

function show(route: string) {
  return { route, title: route, coverUrl: `/covers/${route}.png` };
}

const WEEK: ScheduleDay[] = [
  {
    day: "2026-10-03",
    entries: [entry("aired", "2026-10-03T08:00:00Z"), entry("tonight", "2026-10-03T15:00:00Z")],
  },
  {
    day: "2026-10-04",
    entries: [
      entry("held", "2026-10-04T10:00:00Z", true),
      entry("tomorrow", "2026-10-04T11:00:00Z"),
      entry("tonight", "2026-10-04T15:00:00Z"),
    ],
  },
];

function rows(following: string[], finished: string[] = []) {
  const wall = posterWall(WEEK, NOW, new Set(following));
  return showIndex(wall, following.map(show), finished.map(show));
}

describe("showIndex", () => {
  it("lists the shows with an episode still to air first, soonest first", () => {
    expect(rows(["tomorrow", "aired", "tonight"]).map((row) => row.route)).toEqual([
      "tonight",
      "tomorrow",
      "aired",
    ]);
  });

  it("gives a show its next episode, not one that already aired or a later one", () => {
    const [tonight] = rows(["tonight"]);

    expect(tonight?.status).toBe("upcoming");
    expect(tonight?.next?.airAt).toBe("2026-10-03T15:00:00Z");
  });

  it("says whether a show without a next episode aired, is delayed or has nothing this week", () => {
    expect(
      rows(["aired", "held", "absent"]).map((row) => [row.route, row.status, row.next]),
    ).toEqual([
      ["aired", "aired", null],
      ["held", "delayed", null],
      ["absent", "quiet", null],
    ]);
  });

  it("puts finished shows last and keeps each show's cover", () => {
    const index = rows(["tonight"], ["over"]);

    expect(index.map((row) => [row.route, row.status])).toEqual([
      ["tonight", "upcoming"],
      ["over", "finished"],
    ]);
    expect(index[1]?.coverUrl).toBe("/covers/over.png");
  });

  it("is empty for a user who follows nothing", () => {
    expect(rows([])).toEqual([]);
  });
});
