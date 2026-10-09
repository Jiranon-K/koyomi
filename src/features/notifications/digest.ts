import { createHash } from "node:crypto";

import { followedEpisodesBetween, hasFollowedEpisodeBetween } from "@/features/follows/service";
import type { LineMessenger } from "@/features/line/messenger";
import { findReminderRecipient, listReminderRecipients } from "@/features/line/service";
import { dayWindowFor, dayWindowOf } from "@/features/schedule/day-window";
import { lastSyncRun } from "@/features/schedule/service";
import { isDuplicateKey } from "@/lib/db/mongoose";

import { digestText } from "./digest-text";
import { DigestDelivery, DigestRun, ready, type DigestRunDoc } from "./model";
import type { JobQueue } from "./queue";
import { pushWithinQuota } from "./quota";

export const STALE_AFTER_MS = 24 * 60 * 60 * 1000;

export const CLAIM_LEASE_MS = 60_000;

export type DigestTarget = { userId: string; day: string };

export type DigestSendOutcome =
  | { kind: "sent" }
  | { kind: "already-sent" }
  | { kind: "reminders-off" }
  | { kind: "nothing-airing" }
  | { kind: "wrong-day" }
  | { kind: "refused-quota" }
  | { kind: "in-progress" }
  | { kind: "failed"; error: string };

export type DigestRunSummary = DigestRunDoc & {
  deliveries: { sent: number; refusedQuota: number; failed: number; inProgress: number };
};

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
      if (!(await hasFollowedEpisodeBetween(userId, start, end))) continue;
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
    window.start,
  );

  if (outcome.kind === "sent") {
    await DigestDelivery.updateOne(
      { userId, day },
      { $set: { status: "sent", sentAt: new Date(), error: null } },
    );
    return outcome;
  }
  await DigestDelivery.updateOne(
    { userId, day, status: { $ne: "sent" } },
    outcome.kind === "refused-quota"
      ? { $set: { status: "refused", error: "The monthly push quota is used up." } }
      : { $set: { status: "failed", error: outcome.error } },
  );
  return outcome;
}

export async function lastDigestRun(): Promise<DigestRunSummary | null> {
  await ready();
  const run = await DigestRun.findOne({})
    .sort({ startedAt: -1 })
    .select("-_id -__v")
    .lean<DigestRunDoc>();
  if (!run) return null;

  const rows = await DigestDelivery.find({ day: run.day }).select({ status: 1 }).lean();
  const count = (status: string) => rows.filter((row) => row.status === status).length;
  return {
    ...run,
    deliveries: {
      sent: count("sent"),
      refusedQuota: count("refused"),
      failed: count("failed"),
      inProgress: count("sending"),
    },
  };
}
