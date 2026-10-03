import { dayWindowOf } from "./day-window";
import type { ScheduleDay, ScheduleEntry } from "./service";

export type WallEntry = ScheduleEntry & { aired: boolean; followed: boolean };

export type WallDay = { day: string; entries: WallEntry[] };

export type Wall = {
  days: WallDay[];
  upNext: WallEntry | null;
  today: { day: string; aired: number; remaining: number; delayed: number };
};

export function posterWall(
  week: readonly ScheduleDay[],
  now: Date,
  followed: ReadonlySet<string>,
): Wall {
  const days = week.map(({ day, entries }) => ({
    day,
    entries: entries.map((entry) => ({
      ...entry,
      aired: !entry.delayed && new Date(entry.airAt) <= now,
      followed: followed.has(entry.showRoute),
    })),
  }));
  const isUpcoming = (entry: WallEntry) => !entry.delayed && !entry.aired;
  const today = dayWindowOf(now).day;
  const todays = days.find(({ day }) => day === today)?.entries ?? [];

  return {
    days,
    upNext: days.flatMap((day) => day.entries).find(isUpcoming) ?? null,
    today: {
      day: today,
      aired: todays.filter((entry) => entry.aired).length,
      remaining: todays.filter(isUpcoming).length,
      delayed: todays.filter((entry) => entry.delayed).length,
    },
  };
}
