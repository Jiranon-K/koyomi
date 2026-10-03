import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Follow } from "@/features/follows/model";
import { followShow } from "@/features/follows/service";
import type { LineMessenger, SendResult } from "@/features/line/messenger";
import { LineLink } from "@/features/line/model";
import { recordLineAccount, setFriendByLineUserId, setReminders } from "@/features/line/service";
import { createFakeSource } from "@/features/schedule/fake-source";
import { Episode, Show, SyncRun } from "@/features/schedule/model";
import { syncSchedule } from "@/features/schedule/service";
import { ScheduleSourceError, type ScheduleSource } from "@/features/schedule/source";

import {
  CLAIM_LEASE_MS,
  digestRetryKey,
  fanOutDigest,
  lastDigestRun,
  sendDigest,
  STALE_AFTER_MS,
} from "./digest";
import { DigestDelivery, DigestRun, PushQuota } from "./model";
import type { EnqueueOptions, JobName, JobPayload, JobQueue } from "./queue";
import { pushesThisMonth, quotaMonth } from "./quota";

// Saturday 3 October 2026, 09:00 in Bangkok: the moment the digest job runs.
const NOW = new Date("2026-10-03T02:00:00Z");
const DAY = "2026-10-03";
const DASHBOARD = "https://koyomi.example/dashboard";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const saved = { ...process.env };

// In the fake schedule, relative to NOW: these two air today (22:30 and 00:30 after midnight),
// `salt-and-starlight` airs tomorrow, `moss-and-thunder` in six days.
const TODAY_SHOW = "lantern-street-diaries";
const LATE_SHOW = "clockwork-orchard";
const LATER_SHOW = "moss-and-thunder";

let server: MongoMemoryServer;

const minutes = (count: number) => count * 60_000;
const before = (instant: Date, ms: number) => new Date(instant.getTime() - ms);

function recordingQueue(fail?: (userId: string) => boolean) {
  const jobs: { job: JobName; payload: JobPayload; options: EnqueueOptions | undefined }[] = [];
  const queue: JobQueue = {
    name: "in-process",
    async enqueue(job, payload, options) {
      if (fail?.(String(payload.userId))) throw new Error("queue is down");
      jobs.push({ job, payload, options });
    },
  };
  return { queue, jobs };
}

function recordingMessenger(answer: () => SendResult | Promise<SendResult> = () => ({ ok: true })) {
  const pushed: { lineUserId: string; text: string; retryKey: string }[] = [];
  const messenger: LineMessenger = {
    name: "fake",
    async push(lineUserId, text, retryKey) {
      pushed.push({ lineUserId, text, retryKey });
      return answer();
    },
    async reply() {
      throw new Error("Nothing here replies.");
    },
  };
  return { messenger, pushed };
}

/** A user with LINE linked, a friend of the bot, reminders on, following `shows`. */
async function subscriber(name: string, shows: string[]) {
  const userId = `user-${name}`;
  await recordLineAccount(
    { userId, lineUserId: `U-${name}`, accessToken: "token" },
    async () => true,
  );
  for (const show of shows) expect(await followShow(userId, show)).toBe("followed");
  return userId;
}

function send(userId: string, messenger: LineMessenger, now = NOW) {
  return sendDigest({ userId, day: DAY }, { messenger, dashboardUrl: DASHBOARD }, now);
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("digest-test");
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await lastDigestRun(); // connects
  await Promise.all([
    Follow.deleteMany({}),
    LineLink.deleteMany({}),
    Show.deleteMany({}),
    Episode.deleteMany({}),
    SyncRun.deleteMany({}),
    DigestDelivery.deleteMany({}),
    DigestRun.deleteMany({}),
    PushQuota.deleteMany({}),
  ]);
  // The 08:45 sync, fifteen minutes before the digest.
  await syncSchedule(createFakeSource(), before(NOW, minutes(15)));
});

describe("fanOutDigest", () => {
  it("enqueues one per-user job for each user with reminders on and an episode today", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW, LATE_SHOW]);
    const bob = await subscriber("bob", [LATE_SHOW, LATER_SHOW]);
    const { queue, jobs } = recordingQueue();

    const run = await fanOutDigest(queue, NOW);

    expect(jobs).toEqual([
      {
        job: "digest-send",
        payload: { userId: ada, day: DAY },
        options: { deduplicationId: `digest-${DAY}-${ada}` },
      },
      {
        job: "digest-send",
        payload: { userId: bob, day: DAY },
        options: { deduplicationId: `digest-${DAY}-${bob}` },
      },
    ]);
    expect(run).toMatchObject({ outcome: "enqueued", day: DAY, recipients: 2, enqueued: 2 });
  });

  it("enqueues nothing for a user with nothing airing in today's window", async () => {
    await subscriber("quiet", [LATER_SHOW, "salt-and-starlight"]);
    await subscriber("nothing", []);
    const { queue, jobs } = recordingQueue();

    const run = await fanOutDigest(queue, NOW);

    expect(jobs).toEqual([]);
    expect(run).toMatchObject({ outcome: "enqueued", recipients: 2, enqueued: 0 });
  });

  it("uses the 05:00 to 05:00 window: an episode at 00:30 belongs to the evening before", async () => {
    const ada = await subscriber("ada", [LATE_SHOW]);
    const { queue, jobs } = recordingQueue();

    await fanOutDigest(queue, NOW);
    expect(jobs.map(({ payload }) => payload.userId)).toEqual([ada]);

    // Next morning at 09:00 that episode is yesterday's.
    jobs.length = 0;
    const tomorrow = new Date(NOW.getTime() + STALE_AFTER_MS);
    await SyncRun.updateMany({}, { $set: { startedAt: before(tomorrow, minutes(15)) } });
    expect(await fanOutDigest(queue, tomorrow)).toMatchObject({ outcome: "enqueued", enqueued: 0 });
    expect(jobs).toEqual([]);
  });

  it("skips users whose reminders are not on", async () => {
    const off = await subscriber("off", [TODAY_SHOW]);
    await setReminders(off, false);
    await subscriber("blocked", [TODAY_SHOW]);
    await setFriendByLineUserId("U-blocked", false, NOW);
    await followShow("user-unlinked", TODAY_SHOW);
    const { queue, jobs } = recordingQueue();

    const run = await fanOutDigest(queue, NOW);

    expect(jobs).toEqual([]);
    expect(run).toMatchObject({ outcome: "enqueued", recipients: 0, enqueued: 0 });
  });

  it("enqueues nothing and records the skip when the last good sync is over 24 hours old", async () => {
    await subscriber("ada", [TODAY_SHOW]);
    await SyncRun.updateMany({}, { $set: { startedAt: before(NOW, STALE_AFTER_MS + 1) } });
    const { queue, jobs } = recordingQueue();

    const run = await fanOutDigest(queue, NOW);

    expect(jobs).toEqual([]);
    expect(run).toMatchObject({ outcome: "skipped-stale", day: DAY, recipients: 0, enqueued: 0 });
    expect(run.lastSyncAt).toEqual(before(NOW, STALE_AFTER_MS + 1));
    expect(await DigestRun.countDocuments({ outcome: "skipped-stale" })).toBe(1);
    expect(await lastDigestRun()).toMatchObject({ outcome: "skipped-stale", startedAt: NOW });
  });

  it("skips when the schedule has never been synced", async () => {
    await subscriber("ada", [TODAY_SHOW]);
    await SyncRun.deleteMany({});
    const { queue, jobs } = recordingQueue();

    const run = await fanOutDigest(queue, NOW);

    expect(jobs).toEqual([]);
    expect(run).toMatchObject({ outcome: "skipped-stale", lastSyncAt: null });
  });

  it("still sends from data that is exactly 24 hours old", async () => {
    await subscriber("ada", [TODAY_SHOW]);
    await SyncRun.updateMany({}, { $set: { startedAt: before(NOW, STALE_AFTER_MS) } });
    const { queue, jobs } = recordingQueue();

    expect((await fanOutDigest(queue, NOW)).outcome).toBe("enqueued");
    expect(jobs).toHaveLength(1);
  });

  it("still goes out when the 08:45 sync failed but the data is fresher than 24 hours", async () => {
    await subscriber("ada", [TODAY_SHOW]);
    // The last good sync was yesterday evening; this morning's attempt hit the rate limit.
    await SyncRun.updateMany({}, { $set: { startedAt: before(NOW, minutes(13 * 60)) } });
    const limited: ScheduleSource = {
      name: "animeschedule",
      fetchTimetable: async () => {
        throw new ScheduleSourceError("rate-limited", "AnimeSchedule rate limit reached (429).");
      },
    };
    expect((await syncSchedule(limited, before(NOW, minutes(15)))).outcome).toBe("failure");
    const { queue, jobs } = recordingQueue();

    const run = await fanOutDigest(queue, NOW);

    expect(run).toMatchObject({ outcome: "enqueued", enqueued: 1 });
    expect(run.lastSyncAt).toEqual(before(NOW, minutes(13 * 60)));
    expect(jobs).toHaveLength(1);
  });

  it("does not count a failed sync as fresh data", async () => {
    await subscriber("ada", [TODAY_SHOW]);
    await SyncRun.updateMany({}, { $set: { startedAt: before(NOW, STALE_AFTER_MS + 1) } });
    const down: ScheduleSource = {
      name: "animeschedule",
      fetchTimetable: async () => {
        throw new Error("source is down");
      },
    };
    await syncSchedule(down, before(NOW, minutes(15)));
    const { queue, jobs } = recordingQueue();

    expect((await fanOutDigest(queue, NOW)).outcome).toBe("skipped-stale");
    expect(jobs).toEqual([]);
  });

  it("records a failed run and throws when the queue refuses a job", async () => {
    await subscriber("ada", [TODAY_SHOW]);
    await subscriber("bob", [TODAY_SHOW]);
    const { queue, jobs } = recordingQueue((userId) => userId === "user-bob");

    await expect(fanOutDigest(queue, NOW)).rejects.toThrow("queue is down");

    expect(jobs).toHaveLength(1);
    expect(await lastDigestRun()).toMatchObject({
      outcome: "failed",
      recipients: 2,
      enqueued: 1,
      error: "A digest job could not be enqueued.",
    });
  });
});

describe("digestRetryKey", () => {
  it("is a UUID that is always the same for one user and day", () => {
    const key = digestRetryKey({ userId: "user-ada", day: DAY });

    expect(key).toMatch(UUID);
    expect(digestRetryKey({ userId: "user-ada", day: DAY })).toBe(key);
  });

  it("differs between users and between days", () => {
    const key = digestRetryKey({ userId: "user-ada", day: DAY });

    expect(digestRetryKey({ userId: "user-bob", day: DAY })).not.toBe(key);
    expect(digestRetryKey({ userId: "user-ada", day: "2026-10-04" })).not.toBe(key);
  });
});

describe("sendDigest", () => {
  it("pushes the day's followed episodes and the dashboard link to the user's LINE", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW, LATE_SHOW, LATER_SHOW]);
    const { messenger, pushed } = recordingMessenger();

    expect(await send(ada, messenger)).toEqual({ kind: "sent" });

    expect(pushed).toEqual([
      {
        lineUserId: "U-ada",
        retryKey: digestRetryKey({ userId: ada, day: DAY }),
        text: [
          "Airing today (Thai time):",
          "22:30 Lantern Street Diaries, episode 5",
          "00:30 Clockwork Orchard, episode 3",
          "",
          `Your week: ${DASHBOARD}`,
        ].join("\n"),
      },
    ]);
    expect(await DigestDelivery.findOne({ userId: ada, day: DAY }).lean()).toMatchObject({
      status: "sent",
      attempts: 1,
      error: null,
    });
    expect((await pushesThisMonth(NOW)).count).toBe(1);
  });

  it("sends once when the same job runs twice", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW]);
    const { messenger, pushed } = recordingMessenger();

    expect(await send(ada, messenger)).toEqual({ kind: "sent" });
    expect(await send(ada, messenger)).toEqual({ kind: "already-sent" });

    expect(pushed).toHaveLength(1);
    expect(await DigestDelivery.countDocuments({ userId: ada })).toBe(1);
    expect((await pushesThisMonth(NOW)).count).toBe(1);
  });

  it("sends once when the same job runs several times at the same moment", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW]);
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const { messenger, pushed } = recordingMessenger(async () => {
      await gate;
      return { ok: true };
    });

    const runs = Array.from({ length: 6 }, () => send(ada, messenger));
    // Whoever holds the claim is now waiting for LINE; everyone else has been turned away.
    const losers = await Promise.all(
      runs.map((run) => Promise.race([run, new Promise<null>((r) => setTimeout(r, 500, null))])),
    );
    release();
    const outcomes = await Promise.all(runs);

    expect(losers.filter((outcome) => outcome?.kind === "in-progress")).toHaveLength(5);
    expect(outcomes.filter(({ kind }) => kind === "sent")).toHaveLength(1);
    expect(pushed).toHaveLength(1);
    expect((await pushesThisMonth(NOW)).count).toBe(1);
  });

  it("leaves a failed send retryable, uncounted, and sends once when it is retried", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW]);
    let healthy = false;
    const { messenger, pushed } = recordingMessenger(() =>
      healthy ? { ok: true } : { ok: false, error: "LINE push failed (500)" },
    );

    expect(await send(ada, messenger)).toEqual({ kind: "failed", error: "LINE push failed (500)" });
    expect((await pushesThisMonth(NOW)).count).toBe(0);
    expect(await DigestDelivery.findOne({ userId: ada }).lean()).toMatchObject({
      status: "failed",
      error: "LINE push failed (500)",
      sentAt: null,
    });

    healthy = true;
    expect(await send(ada, messenger)).toEqual({ kind: "sent" });
    expect(await send(ada, messenger)).toEqual({ kind: "already-sent" });

    expect(pushed).toHaveLength(2);
    expect(pushed[0]?.retryKey).toBe(pushed[1]?.retryKey);
    expect((await pushesThisMonth(NOW)).count).toBe(1);
    expect(await DigestDelivery.findOne({ userId: ada }).lean()).toMatchObject({
      status: "sent",
      attempts: 2,
      error: null,
    });
  });

  it("refuses without sending once the month's 290 pushes are used", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW]);
    await PushQuota.create({
      month: quotaMonth(NOW),
      count: 290,
      keys: Array.from({ length: 290 }, (_, index) => `earlier-${index}`),
    });
    const { messenger, pushed } = recordingMessenger();

    expect(await send(ada, messenger)).toEqual({ kind: "refused-quota" });
    expect(await send(ada, messenger)).toEqual({ kind: "refused-quota" });

    expect(pushed).toEqual([]);
    expect((await pushesThisMonth(NOW)).count).toBe(290);
    expect(await DigestDelivery.findOne({ userId: ada }).lean()).toMatchObject({
      status: "refused",
      sentAt: null,
    });
  });

  describe("when a run died after LINE accepted the push but before recording it", () => {
    async function diedAfterPush(userId: string, claimedAt: Date) {
      const key = digestRetryKey({ userId, day: DAY });
      await DigestDelivery.create({ userId, day: DAY, status: "sending", claimedAt, attempts: 1 });
      await PushQuota.create({ month: quotaMonth(NOW), count: 1, keys: [key] });
      return key;
    }

    it("the retry repeats the push with the same retry key and does not count it again", async () => {
      const ada = await subscriber("ada", [TODAY_SHOW]);
      const key = await diedAfterPush(ada, before(NOW, CLAIM_LEASE_MS));
      const { messenger, pushed } = recordingMessenger();

      expect(await send(ada, messenger)).toEqual({ kind: "sent" });

      // LINE drops a push whose retry key it has already accepted, so this is not a second message.
      expect(pushed.map(({ retryKey }) => retryKey)).toEqual([key]);
      expect((await pushesThisMonth(NOW)).count).toBe(1);
      expect(await DigestDelivery.findOne({ userId: ada }).lean()).toMatchObject({
        status: "sent",
        attempts: 2,
      });
    });

    it("waits for the lease of the run that may still be working", async () => {
      const ada = await subscriber("ada", [TODAY_SHOW]);
      await diedAfterPush(ada, before(NOW, CLAIM_LEASE_MS - 1));
      const { messenger, pushed } = recordingMessenger();

      expect(await send(ada, messenger)).toEqual({ kind: "in-progress" });

      expect(pushed).toEqual([]);
    });
  });

  it("asks again whether reminders are on, and sends nothing when they were switched off", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW]);
    await setReminders(ada, false);
    const { messenger, pushed } = recordingMessenger();

    expect(await send(ada, messenger)).toEqual({ kind: "reminders-off" });
    await setReminders(ada, true);
    await setFriendByLineUserId("U-ada", false, NOW);
    expect(await send(ada, messenger)).toEqual({ kind: "reminders-off" });
    expect(await send("user-nobody", messenger)).toEqual({ kind: "reminders-off" });

    expect(pushed).toEqual([]);
    expect(await DigestDelivery.countDocuments({})).toBe(0);
  });

  it("sends nothing when the user has nothing airing that day", async () => {
    const ada = await subscriber("ada", [LATER_SHOW]);
    const { messenger, pushed } = recordingMessenger();

    expect(await send(ada, messenger)).toEqual({ kind: "nothing-airing" });

    expect(pushed).toEqual([]);
    expect(await DigestDelivery.countDocuments({})).toBe(0);
  });

  it("sends nothing for a day that is not today's schedule day", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW]);
    const { messenger, pushed } = recordingMessenger();
    const nextMorning = new Date("2026-10-03T22:00:00Z"); // 05:00 on 4 October in Bangkok

    expect(await send(ada, messenger, nextMorning)).toEqual({ kind: "wrong-day" });
    expect(await send(ada, messenger, before(nextMorning, 1))).toEqual({ kind: "sent" });

    expect(pushed).toHaveLength(1);
  });

  it("marks a delayed episode in the message", async () => {
    const tomorrow = new Date(NOW.getTime() + STALE_AFTER_MS);
    const ada = await subscriber("ada", ["salt-and-starlight"]);
    const { messenger, pushed } = recordingMessenger();

    await sendDigest(
      { userId: ada, day: "2026-10-04" },
      { messenger, dashboardUrl: DASHBOARD },
      tomorrow,
    );

    expect(pushed[0]?.text).toContain(
      "23:00 Salt and Starlight, episode 7 (delayed: Delayed one week)",
    );
  });
});

describe("lastDigestRun", () => {
  it("is null before the first run", async () => {
    expect(await lastDigestRun()).toBeNull();
  });

  it("reports the latest run with what its per-user jobs did", async () => {
    const ada = await subscriber("ada", [TODAY_SHOW]);
    const bob = await subscriber("bob", [TODAY_SHOW]);
    await subscriber("quiet", [LATER_SHOW]);
    const { queue } = recordingQueue();
    await fanOutDigest(queue, before(NOW, STALE_AFTER_MS));
    await fanOutDigest(queue, NOW);
    await send(ada, recordingMessenger().messenger);
    await send(bob, recordingMessenger(() => ({ ok: false, error: "down" })).messenger);

    expect(await lastDigestRun()).toMatchObject({
      startedAt: NOW,
      day: DAY,
      outcome: "enqueued",
      recipients: 3,
      enqueued: 2,
      error: null,
      deliveries: { sent: 1, refusedQuota: 0, failed: 1, inProgress: 0 },
    });
  });
});
