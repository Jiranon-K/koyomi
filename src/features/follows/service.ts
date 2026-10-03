import mongoose from "mongoose";

import { weekWindows } from "@/features/schedule/day-window";
import { Episode, Show } from "@/features/schedule/model";
import {
  episodesBetween,
  lastSyncRun,
  scheduleDays,
  type ScheduleDay,
  type ScheduleEntry,
} from "@/features/schedule/service";
import { connectDb } from "@/lib/db/mongoose";

import { Follow } from "./model";

// Every function takes the user id as its first argument and filters by it: there is no query here
// that reads follows across users.

export type FollowedShow = { route: string; title: string };

export type MyWeek = {
  /** The user's followed episodes over the next seven schedule days. */
  days: ScheduleDay[];
  /** Followed shows that are still airing or yet to air, by title. */
  following: FollowedShow[];
  /** Followed shows that have ended and have no episode left to air, by title. */
  finished: FollowedShow[];
};

let indexes: Promise<unknown> | null = null;

async function ready(): Promise<void> {
  await connectDb();
  indexes ??= Follow.init();
  try {
    await indexes;
  } catch (error) {
    indexes = null;
    throw error;
  }
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
}

/** Follows a show for a user. Following it again changes nothing. */
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
    // Two requests at once both try to insert; the unique index lets one through.
    if (!isDuplicateKey(error)) throw error;
  }
  return "followed";
}

export async function unfollowShow(userId: string, showRoute: string): Promise<void> {
  await ready();
  await Follow.deleteOne({ userId, showRoute });
}

/** The routes of the shows a user follows, in alphabetical order. */
export async function followedRoutes(userId: string): Promise<string[]> {
  await ready();
  const follows = await Follow.find({ userId }).select({ showRoute: 1 }).lean();
  return follows.map((follow) => follow.showRoute).sort();
}

/** The episodes of a user's followed shows airing in `[start, end)`, earliest first. */
export async function followedEpisodesBetween(
  userId: string,
  start: Date,
  end: Date,
): Promise<ScheduleEntry[]> {
  return episodesBetween(start, end, await followedRoutes(userId));
}

/** What the dashboard shows: the user's week, and their follows split into airing and finished. */
export async function myWeek(userId: string, now: Date = new Date()): Promise<MyWeek> {
  const windows = weekWindows(now);
  const first = windows[0];
  const last = windows.at(-1);
  const routes = await followedRoutes(userId);
  if (!first || !last || routes.length === 0) {
    return { days: scheduleDays([], now), following: [], finished: [] };
  }

  const [entries, shows, stillToAir, lastSync] = await Promise.all([
    episodesBetween(first.start, last.end, routes),
    Show.find({ route: { $in: routes } }).lean(),
    Episode.distinct("showRoute", { showRoute: { $in: routes }, airAt: { $gte: first.start } }),
    lastSyncRun("success"),
  ]);

  const upcoming = new Set(stillToAir);
  const following: FollowedShow[] = [];
  const finished: FollowedShow[] = [];
  for (const show of shows.sort((a, b) => a.title.localeCompare(b.title))) {
    // The timetable only lists shows that are airing, so a show the last sync no longer saw has
    // ended (or paused) without the source ever saying "finished" to us.
    const ended =
      show.status === "finished" || (lastSync !== null && show.lastSeenAt < lastSync.startedAt);
    const list = ended && !upcoming.has(show.route) ? finished : following;
    list.push({ route: show.route, title: show.title });
  }

  return { days: scheduleDays(entries, now), following, finished };
}
