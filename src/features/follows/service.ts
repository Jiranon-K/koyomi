import { weekRange } from "@/features/schedule/day-window";
import { Episode, Show } from "@/features/schedule/model";
import {
  episodesBetween,
  lastSyncRun,
  scheduleDays,
  type ScheduleDay,
  type ScheduleEntry,
} from "@/features/schedule/service";
import { indexesReady, isDuplicateKey } from "@/lib/db/mongoose";

import { Follow } from "./model";

export type FollowedShow = { route: string; title: string; coverUrl: string | null };

export type MyWeek = {
  days: ScheduleDay[];
  following: FollowedShow[];
  finished: FollowedShow[];
};

const ready = indexesReady(() => Follow.init());

export async function followShow(
  userId: string,
  showRoute: string,
): Promise<"followed" | "unknown-show"> {
  await ready();
  if (!(await Show.exists({ route: showRoute }))) return "unknown-show";
  try {
    await Follow.updateOne(
      { userId, showRoute },
      { $setOnInsert: { createdAt: new Date() } },
      { upsert: true },
    );
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }
  return "followed";
}

export async function unfollowShow(userId: string, showRoute: string): Promise<void> {
  await ready();
  await Follow.deleteOne({ userId, showRoute });
}

export async function followedRoutes(userId: string): Promise<string[]> {
  await ready();
  const follows = await Follow.find({ userId }).select({ showRoute: 1 }).lean();
  return follows.map((follow) => follow.showRoute).sort();
}

export async function followedEpisodesBetween(
  userId: string,
  start: Date,
  end: Date,
): Promise<ScheduleEntry[]> {
  return episodesBetween(start, end, await followedRoutes(userId));
}

export async function hasFollowedEpisodeBetween(
  userId: string,
  start: Date,
  end: Date,
): Promise<boolean> {
  const routes = await followedRoutes(userId);
  if (routes.length === 0) return false;
  const airing = await Episode.exists({
    airAt: { $gte: start, $lt: end },
    showRoute: { $in: routes },
  });
  return airing !== null;
}

export async function myWeek(userId: string, now: Date = new Date()): Promise<MyWeek> {
  const { start, end } = weekRange(now);
  const routes = await followedRoutes(userId);
  if (routes.length === 0) {
    return { days: scheduleDays([], now), following: [], finished: [] };
  }

  const [entries, shows, stillToAir, lastSync] = await Promise.all([
    episodesBetween(start, end, routes),
    Show.find({ route: { $in: routes } })
      .select({ route: 1, title: 1, coverUrl: 1, status: 1, lastSeenAt: 1 })
      .lean(),
    Episode.distinct("showRoute", { showRoute: { $in: routes }, airAt: { $gte: start } }),
    lastSyncRun("success"),
  ]);

  const upcoming = new Set(stillToAir);
  const following: FollowedShow[] = [];
  const finished: FollowedShow[] = [];
  for (const show of shows.sort((a, b) => a.title.localeCompare(b.title))) {
    const ended =
      show.status === "finished" || (lastSync !== null && show.lastSeenAt < lastSync.startedAt);
    const list = ended && !upcoming.has(show.route) ? finished : following;
    list.push({ route: show.route, title: show.title, coverUrl: show.coverUrl ?? null });
  }

  return { days: scheduleDays(entries, now), following, finished };
}
