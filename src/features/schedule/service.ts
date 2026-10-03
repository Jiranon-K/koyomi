import { indexesReady } from "@/lib/db/mongoose";

import { groupByDay, weekRange } from "./day-window";
import { Episode, Show, SyncRun, type SyncOutcome, type SyncRunDoc } from "./model";
import type { ScheduleSource, SourceEpisode, SourceShow } from "./source";

export type ScheduleEntry = {
  showRoute: string;
  title: string;
  coverUrl: string | null;
  episodeNumber: number;
  firstEpisodeNumber: number | null;
  airAt: string;
  delayed: boolean;
  delayedText: string | null;
};

export type ScheduleDay = {
  day: string;
  entries: ScheduleEntry[];
};

export type WeekSchedule = {
  days: ScheduleDay[];
  lastSyncedAt: string | null;
};

const ready = indexesReady(() => Promise.all([Show.init(), Episode.init(), SyncRun.init()]));

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
            $max: { syncedAt: now },
          },
          upsert: true,
        },
      })),
    );
  }
  const covered = span(episodes);
  if (covered) {
    await Episode.deleteMany({
      airAt: { $gte: covered.from, $lte: covered.to },
      syncedAt: { $lt: now },
    });
  }
  return shows.size;
}

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

export async function lastSyncRun(outcome?: SyncOutcome): Promise<SyncRunDoc | null> {
  await ready();
  return SyncRun.findOne(outcome ? { outcome } : {})
    .sort({ startedAt: -1 })
    .select("-_id -__v")
    .lean<SyncRunDoc>();
}

export async function episodesBetween(
  start: Date,
  end: Date,
  showRoutes?: readonly string[],
): Promise<ScheduleEntry[]> {
  if (showRoutes?.length === 0) return [];
  await ready();

  const findEpisodes = Episode.find({
    airAt: { $gte: start, $lt: end },
    ...(showRoutes ? { showRoute: { $in: showRoutes } } : {}),
  })
    .sort({ airAt: 1, showRoute: 1 })
    .select({ _id: 0, syncedAt: 0, __v: 0 })
    .lean();
  const findShows = (routes: readonly string[]) =>
    Show.find({ route: { $in: routes } })
      .select({ route: 1, title: 1, coverUrl: 1 })
      .lean();

  let episodes: Awaited<typeof findEpisodes>;
  let shows: Awaited<ReturnType<typeof findShows>>;
  if (showRoutes) {
    [episodes, shows] = await Promise.all([findEpisodes, findShows(showRoutes)]);
  } else {
    episodes = await findEpisodes;
    shows = await findShows([...new Set(episodes.map((episode) => episode.showRoute))]);
  }
  const byRoute = new Map(shows.map((show) => [show.route, show]));

  return episodes.map((episode) => {
    const show = byRoute.get(episode.showRoute);
    return {
      showRoute: episode.showRoute,
      title: show?.title ?? episode.showRoute,
      coverUrl: show?.coverUrl ?? null,
      episodeNumber: episode.episodeNumber,
      firstEpisodeNumber: episode.firstEpisodeNumber,
      airAt: episode.airAt.toISOString(),
      delayed: episode.delayed,
      delayedText: episode.delayedText,
    };
  });
}

export function scheduleDays(entries: readonly ScheduleEntry[], now: Date): ScheduleDay[] {
  return groupByDay(entries, (entry) => new Date(entry.airAt), weekRange(now).windows).map(
    ({ window, items }) => ({ day: window.day, entries: items }),
  );
}

export async function weekSchedule(now: Date = new Date()): Promise<WeekSchedule> {
  const { start, end } = weekRange(now);
  const [entries, run] = await Promise.all([episodesBetween(start, end), lastSyncRun("success")]);
  return {
    days: scheduleDays(entries, now),
    lastSyncedAt: run ? run.startedAt.toISOString() : null,
  };
}
