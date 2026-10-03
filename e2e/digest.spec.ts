import { expect, test } from "@playwright/test";

import { dayWindowOf } from "../src/features/schedule/day-window";
import { signJob } from "../src/features/notifications/test-helpers";
import { createVerifiedAccount } from "./account";
import { linePushes } from "./outbox";
import { followBehindTheServer, syncSchedule } from "./schedule";
import { linkLine, removeLineLinks, seedSubscriber } from "./seed";
import { E2E_SIGNING_KEYS } from "./signing-keys.mjs";

const JOBS = ["sync-schedule", "digest-fanout", "digest-send"] as const;

const seeded: string[] = [];

test.afterEach(async () => {
  await removeLineLinks(seeded.splice(0));
});

test("a job endpoint refuses a call that QStash did not sign", async ({ request, baseURL }) => {
  for (const job of JOBS) {
    const url = `${baseURL}/api/jobs/${job}`;
    const body = JSON.stringify({ userId: "nobody", day: "2026-10-03" });

    const unsigned = await request.post(url, { data: body });
    const forged = await request.post(url, {
      data: body,
      headers: { "upstash-signature": signJob({ key: "not-the-key", url, body }) },
    });
    const otherBody = await request.post(url, {
      data: body,
      headers: {
        "upstash-signature": signJob({ key: E2E_SIGNING_KEYS.current, url, body: "{}" }),
      },
    });

    expect([job, unsigned.status(), forged.status(), otherBody.status()]).toEqual([
      job,
      401,
      401,
      401,
    ]);
  }
});

test("a signed call runs the scheduled sync", async ({ request, baseURL }) => {
  const url = `${baseURL}/api/jobs/sync-schedule`;

  const response = await request.post(url, {
    headers: { "upstash-signature": signJob({ key: E2E_SIGNING_KEYS.current, url, body: "" }) },
  });

  expect(response.status()).toBe(200);
  expect(await response.json()).toMatchObject({ outcome: "success" });
});

test("the daily digest reaches a linked user once, and nobody with nothing airing", async ({
  page,
  request,
  baseURL,
}) => {
  const email = await createVerifiedAccount(page, "e2e-digest");
  await syncSchedule(request, "base");
  await followBehindTheServer(email, "lantern-street-diaries");
  await followBehindTheServer(email, "clockwork-orchard");
  await followBehindTheServer(email, "moss-and-thunder");
  const { userId, lineUserId } = await linkLine(email, { reminderSlot: 3 });
  const quiet = await seedSubscriber("quiet", 4, ["moss-and-thunder"]);
  seeded.push(lineUserId, quiet);

  const digest = await request.post("/api/dev/digest");

  expect(digest.status()).toBe(200);
  expect(await digest.json()).toMatchObject({
    outcome: "enqueued",
    recipients: 2,
    enqueued: 1,
    deliveries: { sent: 1, refusedQuota: 0, failed: 0 },
  });
  const pushes = await linePushes(lineUserId, 1);
  expect(pushes.map(({ text }) => text)).toEqual([
    [
      "Airing today (Thai time):",
      "22:30 Lantern Street Diaries, episode 5",
      "00:30 Clockwork Orchard, episode 3",
      "",
      `Your week: ${baseURL}/dashboard`,
    ].join("\n"),
  ]);
  expect(await linePushes(quiet)).toEqual([]);

  expect((await request.post("/api/dev/digest")).status()).toBe(200);
  const url = `${baseURL}/api/jobs/digest-send`;
  const body = JSON.stringify({ userId, day: dayWindowOf(new Date()).day });
  const redelivery = await request.post(url, {
    data: body,
    headers: { "upstash-signature": signJob({ key: E2E_SIGNING_KEYS.next, url, body }) },
  });
  expect(redelivery.status()).toBe(200);
  expect(await redelivery.json()).toEqual({ outcome: "already-sent" });

  expect(await linePushes(lineUserId, 2)).toHaveLength(1);
  expect(await linePushes(quiet)).toEqual([]);
});
