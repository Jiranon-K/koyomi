import { describe, expect, it } from "vitest";

import type { ScheduleEntry } from "@/features/schedule/service";

import { digestText, episodeLine } from "./digest-text";

function entry(overrides: Partial<ScheduleEntry> = {}): ScheduleEntry {
  return {
    showRoute: "lantern-street-diaries",
    title: "Lantern Street Diaries",
    coverUrl: null,
    episodeNumber: 5,
    firstEpisodeNumber: null,
    airAt: "2026-10-03T15:30:00.000Z",
    delayed: false,
    delayedText: null,
    ...overrides,
  };
}

describe("episodeLine", () => {
  it("is the Thai air time, the title and the episode number", () => {
    expect(episodeLine(entry())).toBe("22:30 Lantern Street Diaries, episode 5");
  });

  it("shows a broadcast after midnight with its Thai clock time", () => {
    expect(episodeLine(entry({ airAt: "2026-10-03T17:30:00.000Z" }))).toMatch(/^00:30 /);
  });

  it("names both numbers when several episodes air together", () => {
    expect(episodeLine(entry({ firstEpisodeNumber: 1, episodeNumber: 2 }))).toBe(
      "22:30 Lantern Street Diaries, episodes 1-2",
    );
  });

  it("marks a delayed episode, with the reason when the source gives one", () => {
    expect(episodeLine(entry({ delayed: true, delayedText: "Delayed one week" }))).toBe(
      "22:30 Lantern Street Diaries, episode 5 (delayed: Delayed one week)",
    );
    expect(episodeLine(entry({ delayed: true, delayedText: null }))).toBe(
      "22:30 Lantern Street Diaries, episode 5 (delayed)",
    );
    expect(episodeLine(entry({ delayed: true, delayedText: "Delayed" }))).toBe(
      "22:30 Lantern Street Diaries, episode 5 (delayed)",
    );
  });
});

describe("digestText", () => {
  it("is plain text: a heading, one line per episode, then the dashboard link", () => {
    const text = digestText(
      [
        entry(),
        entry({
          title: "Clockwork Orchard",
          episodeNumber: 3,
          airAt: "2026-10-03T17:30:00.000Z",
          delayed: true,
          delayedText: "Delayed",
        }),
      ],
      "https://koyomi.example/dashboard",
    );

    expect(text).toBe(
      [
        "Airing today (Thai time):",
        "22:30 Lantern Street Diaries, episode 5",
        "00:30 Clockwork Orchard, episode 3 (delayed)",
        "",
        "Your week: https://koyomi.example/dashboard",
      ].join("\n"),
    );
  });

  it("is cut to what LINE accepts and still ends with the dashboard link", () => {
    const many = Array.from({ length: 200 }, (_, index) => entry({ episodeNumber: index + 1 }));

    const text = digestText(many, "https://koyomi.example/dashboard");

    expect(text.length).toBeLessThanOrEqual(5000);
    expect(text.endsWith("(more not shown)\n\nYour week: https://koyomi.example/dashboard")).toBe(
      true,
    );
  });
});
