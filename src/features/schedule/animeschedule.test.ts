import { describe, expect, it } from "vitest";

import {
  createAnimeScheduleSource,
  isoWeekOf,
  MIN_REQUEST_INTERVAL_MS,
  parseTimetable,
} from "./animeschedule";
import documented from "./fixtures/timetable.documented.json";
import { ScheduleSourceError } from "./source";

const NOW = new Date("2026-10-03T05:00:00Z");

type Call = { url: string; authorization: string | null };

function harness(respond: (call: number) => Response) {
  const calls: Call[] = [];
  const sleeps: number[] = [];
  let clock = 0;
  const source = createAnimeScheduleSource({
    token: "test-token",
    fetch: async (input, init) => {
      calls.push({
        url: String(input),
        authorization: new Headers(init?.headers).get("authorization"),
      });
      return respond(calls.length);
    },
    sleep: async (ms) => {
      sleeps.push(ms);
      clock += ms;
    },
    clock: () => clock,
  });
  return { source, calls, sleeps };
}

const json = (body: unknown, status = 200) => Response.json(body, { status });

describe("parseTimetable", () => {
  it("maps a documented timetable entry to an episode with a UTC air time", () => {
    const { episodes } = parseTimetable(documented);

    expect(episodes[0]).toEqual({
      show: {
        route: "lantern-street-diaries",
        title: "Lantern Street Diaries",
        status: "ongoing",
        totalEpisodes: 12,
      },
      episodeNumber: 5,
      firstEpisodeNumber: null,
      airAt: new Date("2026-10-03T15:30:00Z"),
      delayed: false,
      delayedText: null,
    });
  });

  it("marks a delayed episode and keeps the source's delay text", () => {
    const { episodes } = parseTimetable(documented);

    expect(episodes[1]).toMatchObject({
      show: { route: "clockwork-orchard", status: "delayed", totalEpisodes: 0 },
      delayed: true,
      delayedText: "Delayed until further notice",
    });
  });

  it("treats an episode inside the delay period as delayed even without the airing status", () => {
    const entry = {
      title: "Quiet Delay",
      route: "quiet-delay",
      episodeDate: "2026-10-04T16:00:00Z",
      episodeNumber: 2,
      delayedFrom: "2026-10-01T00:00:00Z",
      delayedUntil: "2026-10-15T00:00:00Z",
      airingStatus: "unaired",
    };

    expect(parseTimetable([entry]).episodes[0]?.delayed).toBe(true);
    expect(
      parseTimetable([{ ...entry, episodeDate: "2026-10-16T16:00:00Z" }]).episodes[0]?.delayed,
    ).toBe(false);
  });

  it("reads a block of episodes and converts an offset time to UTC", () => {
    const { episodes } = parseTimetable(documented);

    expect(episodes[2]).toMatchObject({
      show: { route: "harbor-of-paper-cranes", status: "finished" },
      episodeNumber: 13,
      firstEpisodeNumber: 12,
      airAt: new Date("2026-10-05T13:00:00Z"),
    });
  });

  it("skips entries without a route or a real episode date and counts them", () => {
    const { episodes, skipped } = parseTimetable(documented);

    expect(episodes).toHaveLength(3);
    expect(skipped).toBe(2);
  });

  it("rejects a body that is not a list", () => {
    expect(() => parseTimetable({ message: "nope" })).toThrow(ScheduleSourceError);
  });
});

describe("isoWeekOf", () => {
  it("gives the ISO week and its year", () => {
    expect(isoWeekOf(new Date("2026-10-03T05:00:00Z"))).toEqual({ year: 2026, week: 40 });
    expect(isoWeekOf(new Date("2027-01-01T12:00:00Z"))).toEqual({ year: 2026, week: 53 });
    expect(isoWeekOf(new Date("2024-12-30T12:00:00Z"))).toEqual({ year: 2025, week: 1 });
  });
});

describe("createAnimeScheduleSource", () => {
  it("asks for the raw timetable of this week and the next with the bearer token", async () => {
    const { source, calls } = harness(() => json(documented));

    const timetable = await source.fetchTimetable(NOW);

    expect(calls).toEqual([
      {
        url: "https://animeschedule.net/api/v3/timetables/raw?year=2026&week=40",
        authorization: "Bearer test-token",
      },
      {
        url: "https://animeschedule.net/api/v3/timetables/raw?year=2026&week=41",
        authorization: "Bearer test-token",
      },
    ]);
    expect(timetable.requests).toBe(2);
    expect(timetable.skipped).toBe(4);
  });

  it("returns one episode when two weeks list the same one", async () => {
    const { source } = harness(() => json(documented));

    const { episodes } = await source.fetchTimetable(NOW);

    expect(episodes.map((episode) => episode.show.route)).toEqual([
      "lantern-street-diaries",
      "clockwork-orchard",
      "harbor-of-paper-cranes",
    ]);
  });

  it("spaces requests so that it stays under 120 a minute", async () => {
    const { source, sleeps } = harness(() => json([]));

    await source.fetchTimetable(NOW);
    await source.fetchTimetable(NOW);

    expect(60_000 / MIN_REQUEST_INTERVAL_MS).toBeLessThan(120);
    expect(sleeps).toEqual([
      MIN_REQUEST_INTERVAL_MS,
      MIN_REQUEST_INTERVAL_MS,
      MIN_REQUEST_INTERVAL_MS,
    ]);
  });

  it("reports a 429 as a rate-limited failure and stops asking", async () => {
    const { source, calls } = harness(() => json({ message: "slow down" }, 429));

    await expect(source.fetchTimetable(NOW)).rejects.toMatchObject({
      name: "ScheduleSourceError",
      kind: "rate-limited",
    });
    expect(calls).toHaveLength(1);
  });

  it("reports a rejected token without repeating it", async () => {
    const { source } = harness(() => json({}, 401));

    const failure: unknown = await source.fetchTimetable(NOW).catch((error: unknown) => error);

    expect(failure).toMatchObject({ kind: "unauthorized" });
    expect(String(failure)).not.toContain("test-token");
  });

  it("reports another HTTP error, a network failure and a non-JSON body", async () => {
    await expect(harness(() => json({}, 503)).source.fetchTimetable(NOW)).rejects.toMatchObject({
      kind: "http",
    });
    await expect(
      harness(() => {
        throw new TypeError("fetch failed");
      }).source.fetchTimetable(NOW),
    ).rejects.toMatchObject({ kind: "network" });
    await expect(
      harness(() => new Response("<html>")).source.fetchTimetable(NOW),
    ).rejects.toMatchObject({ kind: "invalid" });
  });
});
