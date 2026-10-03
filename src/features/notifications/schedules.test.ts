import { describe, expect, it } from "vitest";

import { JOB_SCHEDULES } from "./schedules";

describe("JOB_SCHEDULES", () => {
  it("is the sync every six hours, the sync at 08:45 and the digest at 09:00 Bangkok time", () => {
    expect(JOB_SCHEDULES.map(({ job, cron }) => ({ job, cron }))).toEqual([
      { job: "sync-schedule", cron: "0 */6 * * *" },
      { job: "sync-schedule", cron: "CRON_TZ=Asia/Bangkok 45 8 * * *" },
      { job: "digest-fanout", cron: "CRON_TZ=Asia/Bangkok 0 9 * * *" },
    ]);
  });

  it("gives each schedule its own fixed id, so creating them again cannot add copies", () => {
    const ids = JOB_SCHEDULES.map(({ scheduleId }) => scheduleId);

    expect(new Set(ids).size).toBe(ids.length);
    expect(ids.every((id) => /^[a-z0-9-]+$/.test(id))).toBe(true);
  });
});
