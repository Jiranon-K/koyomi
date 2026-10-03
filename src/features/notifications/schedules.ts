import { SCHEDULE_TIME_ZONE } from "@/features/schedule/day-window";

import type { JobName } from "./queue";

export type JobSchedule = {
  /** Fixed, so creating the schedules again updates them instead of adding copies. */
  scheduleId: string;
  job: JobName;
  /** QStash cron; `CRON_TZ=` sets the time zone, which is UTC otherwise. */
  cron: string;
  /** How often QStash tries a failed run again. */
  retries: number;
};

/**
 * The three QStash schedules, created by `scripts/create-qstash-schedules.ts`. The morning sync
 * runs fifteen minutes before the digest so the digest reads fresh data; when that sync fails the
 * digest still goes out from the last good one (see `fanOutDigest`).
 */
export const JOB_SCHEDULES: readonly JobSchedule[] = [
  {
    scheduleId: "koyomi-sync-every-six-hours",
    job: "sync-schedule",
    cron: "0 */6 * * *",
    retries: 2,
  },
  {
    scheduleId: "koyomi-sync-before-digest",
    job: "sync-schedule",
    cron: `CRON_TZ=${SCHEDULE_TIME_ZONE} 45 8 * * *`,
    retries: 2,
  },
  {
    scheduleId: "koyomi-digest",
    job: "digest-fanout",
    cron: `CRON_TZ=${SCHEDULE_TIME_ZONE} 0 9 * * *`,
    retries: 3,
  },
];
