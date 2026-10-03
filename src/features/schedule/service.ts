import { connectDb } from "@/lib/db/mongoose";

import { groupByDay, weekWindows } from "./day-window";
import { Episode, Show, SyncRun, type SyncOutcome, type SyncRunDoc } from "./model";
import type { ScheduleSource, SourceEpisode, SourceShow } from "./source";

/** One episode as pages and messages need it. Plain JSON, so it survives the data cache. */
export type ScheduleEntry = {
  showRoute: string;
  title: string;
  episodeNumber: number;
  firstEpisodeNumber: number | null;
  /** ISO 8601, UTC. */
  airAt: string;
  delayed: boolean;
  delayedText: string | null;
};

export type ScheduleDay = {
  /** The Bangkok calendar date the schedule day starts on, `YYYY-MM-DD`. */
  day: string;
  entries: ScheduleEntry[];
};

export type WeekSchedule = {
  days: ScheduleDay[];
  /** When the last successful sync started (ISO 8601), or null before the first one. */
  lastSyncedAt: string | null;
};

let indexes: Promise<unknown> | null = null;

// The connection does not buffer commands, so wait for it before touching a model, and build the
// indexes (unique keys, the episode TTL) once per process.
async function ready(): Promise<void> {
  await connectDb();
  indexes ??= Promise.all([Show.init(), Episode.init(), SyncRun.init()]);
  try {
    await indexes;
  } catch (error) {
    indexes = null;
    throw error;
  }
}

function span(episodes: readonly SourceEpisode[]): { from: Date; to: Date } | null {
  const times = episodes.map((episode) => episode.airAt.getTime());
  return times.length
    ? { from: new Date(Math.min(...times)), to: new Date(Math.max(...times)) }
    : null;
}

async function store(episodes: readonly SourceEpisode[], now: Date): Promise<number> {
  const shows = new Map<string, SourceShow>();
  for (const { show } of episodes) shows.set(show.route, show);

  if (shows.size) {
    await Show.bulkWrite(
      [...shows.values()].map((show) => ({
        updateOne: {
          filter: { route: show.route },
          update: { $set: { ...show, lastSeenAt: now } },
          upsert: true,
        },
      })),
    );
  }
  if (episodes.length) {
    await Episode.bulkWrite(
      episodes.map((episode) => ({
        updateOne: {
          filter: { showRoute: episode.show.route, episodeNumber: episode.episodeNumber },
          update: {
            $set: {
              firstEpisodeNumber: episode.firstEpisodeNumber,
              airAt: episode.airAt,
              delayed: episode.delayed,
              delayedText: episode.delayedText,
            },
            // Never lowered: an older run that overlaps a newer one must not make the newer run's
            // clean-up below mistake these rows for ones it did not write.
            $max: { syncedAt: now },
          },
          upsert: true,
        },
      })),
    );
  }
  // Inside the span the source just described, a row this run did not write is an episode the
  // source withdrew or renumbered; left alone it would be listed, and reminded about, forever.
  const covered = span(episodes);
  if (covered) {
    await Episode.deleteMany({
      airAt: { $gte: covered.from, $lte: covered.to },
      syncedAt: { $lt: now },
    });
  }
  return shows.size;
}

/**
 * Fetches the timetable from `source` and upserts its shows and episodes. Always records the run;
 * a source failure (a 429, a bad token, an outage) becomes a `failure` record, not an exception,
 * and leaves the stored schedule as it was.
 */
export async function syncSchedule(
  source: ScheduleSource,
  now: Date = new Date(),
): Promise<SyncRunDoc> {
  await ready();

  let result: Pick<SyncRunDoc, "outcome" | "requests" | "shows" | "episodes" | "skipped" | "error">;
  try {
    const timetable = await source.fetchTimetable(now);
    result = {
      outcome: "success",
      requests: timetable.requests,
      shows: await store(timetable.episodes, now),
      episodes: timetable.episodes.length,
      skipped: timetable.skipped,
      error: null,
    };
  } catch (error) {
    result = {
      outcome: "failure",
      requests: 0,
      shows: 0,
      episodes: 0,
      skipped: 0,
      error: error instanceof Error ? error.message : String(error),
    };
  }

  const run: SyncRunDoc = {
    startedAt: now,
    finishedAt: new Date(),
    source: source.name,
    ...result,
  };
  await SyncRun.create(run);
  return run;
}

/** The most recent sync run, optionally only of one outcome; null when there is none. */
export async function lastSyncRun(outcome?: SyncOutcome): Promise<SyncRunDoc | null> {
  await ready();
  const run = await SyncRun.findOne(outcome ? { outcome } : {})
    .sort({ startedAt: -1 })
    .lean();
  if (!run) return null;
  const { startedAt, finishedAt, source, requests, shows, episodes, skipped, error } = run;
  return {
    startedAt,
    finishedAt,
    outcome: run.outcome,
    source,
    requests,
    shows,
    episodes,
    skipped,
    error,
  };
}

/**
 * Episodes airing in `[start, end)`, earliest first. Pass `showRoutes` to keep only those shows
 * (a user's follows); an empty list returns nothing.
 */
export async function episodesBetween(
  start: Date,
  end: Date,
  showRoutes?: readonly string[],
): Promise<ScheduleEntry[]> {
  if (showRoutes?.length === 0) return [];
  await ready();

  const episodes = await Episode.find({
    airAt: { $gte: start, $lt: end },
    ...(showRoutes ? { showRoute: { $in: showRoutes } } : {}),
  })
    .sort({ airAt: 1, showRoute: 1 })
    .lean();
  const shows = await Show.find({ route: { $in: episodes.map((episode) => episode.showRoute) } })
    .select({ route: 1, title: 1 })
    .lean();
  const titles = new Map(shows.map((show) => [show.route, show.title]));

  return episodes.map((episode) => ({
    showRoute: episode.showRoute,
    title: titles.get(episode.showRoute) ?? episode.showRoute,
    episodeNumber: episode.episodeNumber,
    firstEpisodeNumber: episode.firstEpisodeNumber,
    airAt: episode.airAt.toISOString(),
    delayed: episode.delayed,
    delayedText: episode.delayedText,
  }));
}

/** Files entries under the seven schedule days that start with the one containing `now`. */
export function scheduleDays(entries: readonly ScheduleEntry[], now: Date): ScheduleDay[] {
  return groupByDay(entries, (entry) => new Date(entry.airAt), weekWindows(now)).map(
    ({ window, items }) => ({ day: window.day, entries: items }),
  );
}

/** The public week: every episode of the next seven schedule days, grouped by day. */
export async function weekSchedule(now: Date = new Date()): Promise<WeekSchedule> {
  const windows = weekWindows(now);
  const first = windows[0];
  const last = windows.at(-1);
  if (!first || !last) return { days: [], lastSyncedAt: null };

  const [entries, run] = await Promise.all([
    episodesBetween(first.start, last.end),
    lastSyncRun("success"),
  ]);
  return {
    days: scheduleDays(entries, now),
    lastSyncedAt: run ? run.startedAt.toISOString() : null,
  };
}
