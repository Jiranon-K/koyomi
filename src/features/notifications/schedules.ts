import { SCHEDULE_TIME_ZONE } from "@/features/schedule/day-window";

import type { JobName } from "./queue";

export type JobSchedule = {
  scheduleId: string;
  job: JobName;
  cron: string;
  retries: number;
};

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
