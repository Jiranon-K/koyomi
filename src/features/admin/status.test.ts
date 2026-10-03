import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Follow } from "@/features/follows/model";
import { followShow } from "@/features/follows/service";
import type { LineMessenger } from "@/features/line/messenger";
import { LineLink } from "@/features/line/model";
import { recordLineAccount, setReminders } from "@/features/line/service";
import { fanOutDigest, sendDigest } from "@/features/notifications/digest";
import { DigestDelivery, DigestRun, PushQuota } from "@/features/notifications/model";
import type { JobQueue } from "@/features/notifications/queue";
import { createFakeSource } from "@/features/schedule/fake-source";
import { Episode, Show, SyncRun } from "@/features/schedule/model";
import { syncSchedule } from "@/features/schedule/service";
import type { ScheduleSource } from "@/features/schedule/source";

import { adminStatus } from "./status";

const NOW = new Date("2026-10-03T02:00:00Z");
const DAY = "2026-10-03";
const SECRET = "test-secret-test-secret-test-secret-1234";
const TOKEN = "animeschedule-token-value";
const saved = { ...process.env };

let server: MongoMemoryServer;

const before = (minutes: number) => new Date(NOW.getTime() - minutes * 60_000);

const queue: JobQueue = { name: "in-process", enqueue: async () => undefined };

const messenger: LineMessenger = {
  name: "fake",
  push: async () => ({ ok: true }),
  reply: async () => ({ ok: true }),
};

function failingSource(message: string): ScheduleSource {
  return {
    name: "animeschedule",
    async fetchTimetable() {
      throw new Error(message);
    },
  };
}

async function linked(name: string, friend = true) {
  const userId = `user-${name}`;
  await recordLineAccount(
    { userId, lineUserId: `U-${name}`, accessToken: "token" },
    async () => friend,
  );
  return userId;
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("admin-status-test");
  process.env.BETTER_AUTH_SECRET = SECRET;
  process.env.ANIMESCHEDULE_TOKEN = TOKEN;
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await adminStatus(NOW);
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
});

describe("adminStatus", () => {
  it("says nothing has run yet on a fresh database", async () => {
    expect(await adminStatus(NOW)).toEqual({
      sync: { state: "never" },
      digest: { state: "never" },
      pushes: { month: "2026-10", count: 0, limit: 290 },
      reminders: { taken: 0, reachable: 0, cap: 10 },
    });
  });

  it("reports the last sync, its time and what it stored", async () => {
    await syncSchedule(createFakeSource(), before(120));
    await syncSchedule(createFakeSource(), before(15));

    const { sync } = await adminStatus(NOW);

    expect(sync).toEqual({
      state: "success",
      at: before(15),
      source: "fake",
      shows: 6,
      episodes: 7,
      skipped: 0,
      reason: null,
      lastSuccessAt: before(15),
    });
  });

  it("reports a failed sync as failed, with its reason and the last success before it", async () => {
    await syncSchedule(createFakeSource(), before(120));
    await syncSchedule(failingSource("AnimeSchedule rate limit reached (429)."), before(15));

    const { sync } = await adminStatus(NOW);

    expect(sync).toMatchObject({
      state: "failure",
      at: before(15),
      source: "animeschedule",
      reason: "AnimeSchedule rate limit reached (429).",
      lastSuccessAt: before(120),
    });
  });

  it("has no last success when every sync so far failed", async () => {
    await syncSchedule(failingSource("AnimeSchedule could not be reached."), before(15));

    expect((await adminStatus(NOW)).sync).toMatchObject({ state: "failure", lastSuccessAt: null });
  });

  it("never repeats a configured secret or a credential in the failure reason", async () => {
    const uri = ["mongodb+srv:", "", "koyomi:hunter2-password@cluster0.example/koyomi"].join("/");
    await syncSchedule(
      failingSource(
        `request with Bearer ${TOKEN} failed; secret ${SECRET}; could not connect to ${uri}`,
      ),
      before(15),
    );

    const status = await adminStatus(NOW);
    const shown = JSON.stringify(status);

    expect(status.sync).toMatchObject({ state: "failure" });
    expect(shown).not.toContain(TOKEN);
    expect(shown).not.toContain(SECRET);
    expect(shown).not.toContain("hunter2-password");
    expect(shown).toContain("ANIMESCHEDULE_TOKEN");
  });

  it("keeps an overlong failure reason short", async () => {
    await syncSchedule(failingSource("x".repeat(5000)), before(15));

    const { sync } = await adminStatus(NOW);

    expect(sync.state === "failure" && sync.reason?.length).toBeLessThanOrEqual(300);
  });

  it("reports the last digest run with what its deliveries did", async () => {
    await syncSchedule(createFakeSource(), before(15));
    const ada = await linked("ada");
    const bob = await linked("bob");
    await linked("carol");
    for (const userId of [ada, bob]) await followShow(userId, "lantern-street-diaries");
    await fanOutDigest(queue, NOW);
    await sendDigest(
      { userId: ada, day: DAY },
      { messenger, dashboardUrl: "https://koyomi.example/dashboard" },
      NOW,
    );

    const { digest, pushes } = await adminStatus(NOW);

    expect(digest).toEqual({
      state: "enqueued",
      at: NOW,
      day: DAY,
      recipients: 3,
      enqueued: 2,
      reason: null,
      deliveries: { sent: 1, refusedQuota: 0, failed: 0, inProgress: 0 },
    });
    expect(pushes).toEqual({ month: "2026-10", count: 1, limit: 290 });
  });

  it("reports a skipped digest as skipped", async () => {
    await syncSchedule(createFakeSource(), before(25 * 60));
    await fanOutDigest(queue, NOW);

    expect((await adminStatus(NOW)).digest).toMatchObject({
      state: "skipped-stale",
      at: NOW,
      day: DAY,
      enqueued: 0,
    });
  });

  it("counts the reminder places taken, and how many of those users can be reached", async () => {
    await linked("ada");
    await linked("bob");
    await linked("not-a-friend", false);
    const off = await linked("switched-off");
    await setReminders(off, false);

    expect((await adminStatus(NOW)).reminders).toEqual({ taken: 3, reachable: 2, cap: 10 });
  });
});
