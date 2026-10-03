import { revalidateTag, unstable_cache } from "next/cache";

import { fakesEnabled, scheduleEnv } from "@/lib/env";

import { createAnimeScheduleSource } from "./animeschedule";
import { dayWindowOf } from "./day-window";
import { createFakeSource } from "./fake-source";
import type { SyncRunDoc } from "./model";
import { syncSchedule, weekSchedule, type WeekSchedule } from "./service";
import type { ScheduleSource } from "./source";

const SCHEDULE_TAG = "schedule";
const CACHE_SECONDS = 3600;

let real: ScheduleSource | null = null;

export function scheduleSource(): ScheduleSource {
  if (fakesEnabled()) return createFakeSource();
  return {
    name: "animeschedule",
    async fetchTimetable(now) {
      real ??= createAnimeScheduleSource({ token: scheduleEnv().ANIMESCHEDULE_TOKEN });
      return real.fetchTimetable(now);
    },
  };
}

export async function runScheduleSync(
  source: ScheduleSource = scheduleSource(),
  now: Date = new Date(),
): Promise<SyncRunDoc> {
  const run = await syncSchedule(source, now);
  if (run.outcome === "success") revalidateTag(SCHEDULE_TAG, { expire: 0 });
  return run;
}

const cachedWeek = unstable_cache(
  (dayStart: string) => weekSchedule(new Date(dayStart)),
  ["schedule-week", "covers"],
  { tags: [SCHEDULE_TAG], revalidate: CACHE_SECONDS },
);

export function cachedWeekSchedule(now: Date = new Date()): Promise<WeekSchedule> {
  return cachedWeek(dayWindowOf(now).start.toISOString());
}
