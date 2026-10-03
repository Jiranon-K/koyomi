import { createHash } from "node:crypto";

import mongoose from "mongoose";

import { followedEpisodesBetween } from "@/features/follows/service";
import type { LineMessenger } from "@/features/line/messenger";
import { findReminderRecipient, listReminderRecipients } from "@/features/line/service";
import { dayWindowFor, dayWindowOf } from "@/features/schedule/day-window";
import { lastSyncRun } from "@/features/schedule/service";

import { digestText } from "./digest-text";
import { DigestDelivery, DigestRun, ready, type DigestRunDoc } from "./model";
import type { JobQueue } from "./queue";
import { pushWithinQuota } from "./quota";

/** A digest is not sent from schedule data whose last successful sync is older than this. */
export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

/**
 * How long a per-user job may hold its claim before another attempt may take it over. Longer than
 * a push can take (the sender gives up after ten seconds), shorter than the gap before the queue's
 * second retry.
 */
export const CLAIM_LEASE_MS = 60_000;

export type DigestTarget = { userId: string; day: string };

export type DigestSendOutcome =
  | { kind: "sent" }
  /** An earlier run of the same job already delivered this digest. */
  | { kind: "already-sent" }
  /** The user switched reminders off, unlinked or blocked the bot since the fan-out. */
  | { kind: "reminders-off" }
  | { kind: "nothing-airing" }
  /** The job ran outside the schedule day it was made for (a very late retry). */
  | { kind: "wrong-day" }
  | { kind: "refused-quota" }
  /** Another run of the same job holds the claim right now. Try again later. */
  | { kind: "in-progress" }
  /** Nothing was sent. Try again later. */
  | { kind: "failed"; error: string };

export type DigestRunSummary = DigestRunDoc & {
  /** What the per-user jobs of the run's day have done so far. */
  deliveries: { sent: number; refusedQuota: number; failed: number; inProgress: number };
};

function isDuplicateKey(error: unknown): boolean {
  return error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
}

/**
 * The LINE retry key of one user's digest for one day: always the same UUID. If a job dies after
 * LINE accepted the push but before that was recorded, the retry pushes with this key again and
 * LINE drops it, so the user still gets one message.
 */
export function digestRetryKey({ userId, day }: DigestTarget): string {
  const hex = createHash("sha256").update(`koyomi:digest:${day}:${userId}`).digest("hex");
  const variant = ((parseInt(hex.slice(16, 18), 16) & 0x3f) | 0x80).toString(16);
  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    `4${hex.slice(13, 16)}`,
    `${variant}${hex.slice(18, 20)}`,
    hex.slice(20, 32),
  ].join("-");
}

/**
 * The 09:00 job. For each user with reminders on who has a followed episode in today's schedule
 * day, enqueues one per-user job; a user with nothing airing gets none. When the last successful
 * sync is older than 24 hours (or there never was one) it enqueues nothing and records the skip.
 * Every run is recorded. If the queue refuses a job the run is recorded as failed and the error is
 * thrown, so the caller reports failure and the job is retried.
 */
export async function fanOutDigest(queue: JobQueue, now: Date = new Date()): Promise<DigestRunDoc> {
  await ready();
  const { day, start, end } = dayWindowOf(now);
  const lastSync = await lastSyncRun("success");
  const lastSyncAt = lastSync?.startedAt ?? null;
  const run = { startedAt: now, day, recipients: 0, enqueued: 0, lastSyncAt, error: null };

  const record = async (result: Partial<DigestRunDoc> & Pick<DigestRunDoc, "outcome">) => {
    const doc: DigestRunDoc = { ...run, ...result, finishedAt: new Date() };
    await DigestRun.create(doc);
    return doc;
  };

  if (!lastSyncAt || now.getTime() - lastSyncAt.getTime() > STALE_AFTER_MS) {
    return record({ outcome: "skipped-stale" });
  }

  const recipients = await listReminderRecipients();
  let enqueued = 0;
  try {
    for (const { userId } of recipients) {
      const episodes = await followedEpisodesBetween(userId, start, end);
      if (episodes.length === 0) continue;
      await queue.enqueue(
        "digest-send",
        { userId, day },
        { deduplicationId: `digest-${day}-${userId}` },
      );
      enqueued++;
    }
  } catch (error) {
    await record({
      outcome: "failed",
      recipients: recipients.length,
      enqueued,
      error: "A digest job could not be enqueued.",
    });
    throw error;
  }
  return record({ outcome: "enqueued", recipients: recipients.length, enqueued });
}

/**
 * Takes the (user, day) claim. The unique index decides: of any number of runs at the same moment
 * exactly one inserts the row. A row left by an attempt that failed, was refused, or died holding
 * the claim (its lease ran out) can be taken over, again by exactly one run.
 */
async function claim(
  { userId, day }: DigestTarget,
  now: Date,
): Promise<"claimed" | "already-sent" | "in-progress"> {
  try {
    await DigestDelivery.create({
      userId,
      day,
      status: "sending",
      claimedAt: now,
      attempts: 1,
      sentAt: null,
      error: null,
    });
    return "claimed";
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
  }

  const leaseExpired = new Date(now.getTime() - CLAIM_LEASE_MS);
  const { matchedCount } = await DigestDelivery.updateOne(
    {
      userId,
      day,
      $or: [
        { status: { $in: ["failed", "refused"] } },
        { status: "sending", claimedAt: { $lte: leaseExpired } },
      ],
    },
    { $set: { status: "sending", claimedAt: now, error: null }, $inc: { attempts: 1 } },
  );
  if (matchedCount === 1) return "claimed";

  const row = await DigestDelivery.findOne({ userId, day }).select({ status: 1 }).lean();
  return row?.status === "sent" ? "already-sent" : "in-progress";
}

/**
 * The per-user job: sends one user's digest for one schedule day, at most once however often it
 * runs. It asks again whether reminders are on, claims the unique (user, day) record, and only
 * then pushes, through the quota guard. A failed push releases the claim (and its place in the
 * quota) so that a retry can send; a refused or sent one is final.
 */
export async function sendDigest(
  target: DigestTarget,
  deps: { messenger: LineMessenger; dashboardUrl: string },
  now: Date = new Date(),
): Promise<DigestSendOutcome> {
  await ready();
  const { userId, day } = target;
  if (dayWindowOf(now).day !== day) return { kind: "wrong-day" };
  const window = dayWindowFor(day);

  const recipient = await findReminderRecipient(userId);
  if (!recipient) return { kind: "reminders-off" };

  const episodes = await followedEpisodesBetween(userId, window.start, window.end);
  if (episodes.length === 0) return { kind: "nothing-airing" };

  const claimed = await claim(target, now);
  if (claimed !== "claimed") return { kind: claimed };

  const outcome = await pushWithinQuota(
    deps.messenger,
    {
      lineUserId: recipient.lineUserId,
      text: digestText(episodes, deps.dashboardUrl),
      retryKey: digestRetryKey(target),
    },
    now,
  );

  if (outcome.kind === "sent") {
    await DigestDelivery.updateOne(
      { userId, day },
      { $set: { status: "sent", sentAt: new Date(), error: null } },
    );
    return outcome;
  }
  // Never overwrite `sent`: a slower run of the same job may have delivered in the meantime.
  await DigestDelivery.updateOne(
    { userId, day, status: { $ne: "sent" } },
    outcome.kind === "refused-quota"
      ? { $set: { status: "refused", error: "The monthly push quota is used up." } }
      : { $set: { status: "failed", error: outcome.error } },
  );
  return outcome;
}

/** The most recent fan-out run (sent or skipped) with what its day's per-user jobs did. */
export async function lastDigestRun(): Promise<DigestRunSummary | null> {
  await ready();
  const run = await DigestRun.findOne({}).sort({ startedAt: -1 }).lean();
  if (!run) return null;

  const rows = await DigestDelivery.find({ day: run.day }).select({ status: 1 }).lean();
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  const { startedAt, finishedAt, day, outcome, recipients, enqueued, lastSyncAt, error } = run;
  return {
    startedAt,
    finishedAt,
    day,
    outcome,
    recipients,
    enqueued,
    lastSyncAt,
    error,
    deliveries: {
      sent: count("sent"),
      refusedQuota: count("refused"),
      failed: count("failed"),
      inProgress: count("sending"),
    },
  };
}
