import * as z from "zod";

import {
  ScheduleSourceError,
  SHOW_STATUSES,
  type ScheduleSource,
  type ShowStatus,
  type SourceEpisode,
  type SourceTimetable,
} from "./source";

// AnimeSchedule.net API v3. Built from https://animeschedule.net/api/v3/documentation (read on
// 2026-10-03) without a token, so three things are assumptions until checked against a real
// response (see `scripts/record-animeschedule-sample.ts`):
//   1. `week` is the ISO 8601 week number and `year` its ISO week-year;
//   2. a delayed episode has `airingStatus: "delayed-air"`, or an `episodeDate` inside
//      `delayedFrom`..`delayedUntil`;
//   3. an unset datetime is the documented null value `0001-01-01T00:00:00Z`.

const BASE_URL = "https://animeschedule.net/api/v3";
const REQUEST_TIMEOUT_MS = 15_000;
const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/** The documented limit is 120 requests a minute; one every 600 ms is 100. */
export const MIN_REQUEST_INTERVAL_MS = 600;

/** This week and the next: enough to cover seven schedule days from any moment. */
const WEEKS_AHEAD = [0, 1] as const;

const datetime = z
  .string()
  .optional()
  .transform((value) => {
    const time = value ? Date.parse(value) : Number.NaN;
    // The API writes "no date" as year 1.
    return Number.isNaN(time) || time <= 0 ? null : new Date(time);
  });

const count = z.number().int().nonnegative().optional().default(0);

const timetableEntry = z.object({
  route: z.string().min(1),
  title: z.string().min(1),
  status: z.string().optional().default(""),
  episodeDate: datetime,
  episodeNumber: z.number().int().nonnegative(),
  subtractedEpisodeNumber: count,
  episodes: count,
  delayedText: z.string().optional().default(""),
  delayedFrom: datetime,
  delayedUntil: datetime,
  airingStatus: z.string().optional().default(""),
});

function showStatus(status: string): ShowStatus {
  const known = SHOW_STATUSES.find((candidate) => candidate === status.toLowerCase());
  return known ?? "unknown";
}

function toEpisode(entry: z.output<typeof timetableEntry>): SourceEpisode | null {
  const airAt = entry.episodeDate;
  if (!airAt) return null;
  const { delayedFrom, delayedUntil } = entry;
  const insideDelay =
    delayedFrom !== null && delayedUntil !== null && airAt >= delayedFrom && airAt <= delayedUntil;
  const firstEpisodeNumber = entry.subtractedEpisodeNumber;

  return {
    show: {
      route: entry.route,
      title: entry.title,
      status: showStatus(entry.status),
      totalEpisodes: entry.episodes,
    },
    episodeNumber: entry.episodeNumber,
    firstEpisodeNumber:
      firstEpisodeNumber > 0 && firstEpisodeNumber < entry.episodeNumber
        ? firstEpisodeNumber
        : null,
    airAt,
    delayed: entry.airingStatus === "delayed-air" || insideDelay,
    delayedText: entry.delayedText.trim() || null,
  };
}

/** Reads the body of `GET /timetables`. Unreadable entries are skipped and counted. */
export function parseTimetable(body: unknown): Pick<SourceTimetable, "episodes" | "skipped"> {
  if (!Array.isArray(body)) {
    throw new ScheduleSourceError("invalid", "AnimeSchedule returned a timetable that is no list.");
  }
  const episodes: SourceEpisode[] = [];
  for (const item of body) {
    const parsed = timetableEntry.safeParse(item);
    const episode = parsed.success ? toEpisode(parsed.data) : null;
    if (episode) episodes.push(episode);
  }
  return { episodes, skipped: body.length - episodes.length };
}

/** The ISO 8601 week that contains `instant` (UTC), and the year that week belongs to. */
export function isoWeekOf(instant: Date): { year: number; week: number } {
  const day = new Date(
    Date.UTC(instant.getUTCFullYear(), instant.getUTCMonth(), instant.getUTCDate()),
  );
  // The week belongs to the year of its Thursday.
  day.setUTCDate(day.getUTCDate() + 4 - (day.getUTCDay() || 7));
  const year = day.getUTCFullYear();
  const week = Math.ceil(((day.getTime() - Date.UTC(year, 0, 1)) / 86_400_000 + 1) / 7);
  return { year, week };
}

type Options = {
  token: string;
  fetch?: typeof globalThis.fetch;
  sleep?: (ms: number) => Promise<void>;
  clock?: () => number;
};

function failureOf(status: number): ScheduleSourceError {
  if (status === 429) {
    return new ScheduleSourceError("rate-limited", "AnimeSchedule rate limit reached (429).");
  }
  if (status === 401 || status === 403) {
    return new ScheduleSourceError("unauthorized", `AnimeSchedule rejected the token (${status}).`);
  }
  return new ScheduleSourceError("http", `AnimeSchedule answered ${status}.`);
}

export function createAnimeScheduleSource({
  token,
  fetch = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  clock = Date.now,
}: Options): ScheduleSource {
  let lastRequestAt: number | null = null;

  async function throttle(): Promise<void> {
    if (lastRequestAt !== null) {
      const wait = lastRequestAt + MIN_REQUEST_INTERVAL_MS - clock();
      if (wait > 0) await sleep(wait);
    }
    lastRequestAt = clock();
  }

  async function fetchWeek(instant: Date) {
    const { year, week } = isoWeekOf(instant);
    await throttle();

    let response: Response;
    try {
      response = await fetch(`${BASE_URL}/timetables/raw?year=${year}&week=${week}`, {
        headers: { authorization: `Bearer ${token}`, accept: "application/json" },
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        cache: "no-store",
      });
    } catch {
      throw new ScheduleSourceError("network", "AnimeSchedule could not be reached.");
    }
    if (!response.ok) throw failureOf(response.status);

    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new ScheduleSourceError("invalid", "AnimeSchedule returned a body that is not JSON.");
    }
    return parseTimetable(body);
  }

  return {
    name: "animeschedule",
    async fetchTimetable(now) {
      const episodes = new Map<string, SourceEpisode>();
      let skipped = 0;
      for (const ahead of WEEKS_AHEAD) {
        const result = await fetchWeek(new Date(now.getTime() + ahead * WEEK_MS));
        skipped += result.skipped;
        for (const episode of result.episodes) {
          episodes.set(`${episode.show.route}#${episode.episodeNumber}`, episode);
        }
      }
      return { episodes: [...episodes.values()], requests: WEEKS_AHEAD.length, skipped };
    },
  };
}
