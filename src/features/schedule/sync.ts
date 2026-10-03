import { revalidateTag, unstable_cache } from "next/cache";

import { fakesEnabled, scheduleEnv } from "@/lib/env";

import { createAnimeScheduleSource } from "./animeschedule";
import { dayWindowOf } from "./day-window";
import { createFakeSource } from "./fake-source";
import type { SyncRunDoc } from "./model";
import { syncSchedule, weekSchedule, type WeekSchedule } from "./service";
import type { ScheduleSource } from "./source";

// The part of the schedule feature that needs a running Next.js server: choosing the source from
// the environment, and the data cache in front of the public week.

const SCHEDULE_TAG = "schedule";
/** A safety net only: every successful sync expires the cache at once. */
const CACHE_SECONDS = 3600;

let real: ScheduleSource | null = null;

/** The source the environment selects: the fake when `USE_FAKES` is true, else AnimeSchedule. */
export function scheduleSource(): ScheduleSource {
  if (fakesEnabled()) return createFakeSource();
  return {
    name: "animeschedule",
    // Built on first use and kept, so the request throttle spans every sync of this process. A
    // missing token surfaces here, inside the sync, and is recorded as a failed run.
    async fetchTimetable(now) {
      real ??= createAnimeScheduleSource({ token: scheduleEnv().ANIMESCHEDULE_TOKEN });
      return real.fetchTimetable(now);
    },
  };
}

/**
 * Runs one sync and, when it succeeds, expires the cached public schedule. Call it from a Route
 * Handler or a Server Action: revalidation needs a request.
 */
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
  ["schedule-week"],
  { tags: [SCHEDULE_TAG], revalidate: CACHE_SECONDS },
);

/** The public week from the data cache. The key is the schedule day, so it rolls over at 05:00. */
export function cachedWeekSchedule(now: Date = new Date()): Promise<WeekSchedule> {
  return cachedWeek(dayWindowOf(now).start.toISOString());
}
