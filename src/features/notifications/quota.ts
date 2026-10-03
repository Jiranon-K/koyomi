import mongoose from "mongoose";

import type { LineMessenger } from "@/features/line/messenger";
import { SCHEDULE_TIME_ZONE } from "@/features/schedule/day-window";

import { PushQuota, ready } from "./model";

/**
 * Pushes allowed per Bangkok calendar month. The free LINE plan gives 300; the last ten are kept
 * as a margin. Reply messages are free and never pass through here.
 */
export const PUSH_LIMIT = 290;

export type PushOutcome =
  | { kind: "sent" }
  /** The month's quota is used up: nothing was sent, and trying again this month cannot help. */
  | { kind: "refused-quota" }
  /** Nothing was sent and nothing was counted; the push may be tried again. */
  | { kind: "failed"; error: string };

export type PushCount = { month: string; count: number; limit: number };

const monthParts = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHEDULE_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
});

/** The Bangkok calendar month of an instant, as `YYYY-MM`. */
export function quotaMonth(instant: Date): string {
  const parts = new Map(monthParts.formatToParts(instant).map((part) => [part.type, part.value]));
  return `${parts.get("year")}-${parts.get("month")}`;
}

function isDuplicateKey(error: unknown): boolean {
  return error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
}

/**
 * Counts one push against the month, atomically: the filter and the increment are one operation on
 * one document, so two pushes at the same moment cannot both take the last place. Counting is
 * idempotent per `key`: `held` means this push was already counted by an earlier attempt.
 */
async function reserve(month: string, key: string): Promise<"reserved" | "held" | "refused"> {
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      await PushQuota.updateOne(
        { month, count: { $lt: PUSH_LIMIT }, keys: { $ne: key } },
        { $inc: { count: 1 }, $push: { keys: key } },
        { upsert: true, setDefaultsOnInsert: false },
      );
      return "reserved";
    } catch (error) {
      // The month's row exists but did not match the filter, so the upsert tried to insert a
      // second one and the unique index refused it.
      if (!isDuplicateKey(error)) throw error;
    }
    const row = await PushQuota.findOne({ month }).lean();
    if (row?.keys.includes(key)) return "held";
    if (row && row.count >= PUSH_LIMIT) return "refused";
    // Otherwise another push created the row at the same moment: go round again.
  }
  throw new Error("The push quota could not be reserved.");
}

async function release(month: string, key: string): Promise<void> {
  await PushQuota.updateOne({ month, keys: key }, { $inc: { count: -1 }, $pull: { keys: key } });
}

/**
 * The only way a push leaves this app. It takes a place in the month's quota first and refuses,
 * without sending, once `PUSH_LIMIT` pushes are counted. A push that fails gives its place back.
 *
 * `retryKey` identifies the push to LINE and to the counter, so an attempt repeated after a crash
 * is neither sent nor counted twice. If the earlier attempt already counted it (`held`), a failure
 * now keeps the place: that attempt may have reached LINE.
 */
export async function pushWithinQuota(
  messenger: LineMessenger,
  push: { lineUserId: string; text: string; retryKey: string },
  now: Date = new Date(),
): Promise<PushOutcome> {
  await ready();
  const month = quotaMonth(now);
  const place = await reserve(month, push.retryKey);
  if (place === "refused") return { kind: "refused-quota" };

  let error: string;
  try {
    const result = await messenger.push(push.lineUserId, push.text, push.retryKey);
    if (result.ok) return { kind: "sent" };
    error = result.error;
  } catch {
    error = "The LINE sender threw.";
  }
  if (place === "reserved") await release(month, push.retryKey);
  return { kind: "failed", error };
}

/** How many pushes are counted in the Bangkok month that contains `now`, against the limit. */
export async function pushesThisMonth(now: Date = new Date()): Promise<PushCount> {
  await ready();
  const month = quotaMonth(now);
  const row = await PushQuota.findOne({ month }).select({ count: 1 }).lean();
  return { month, count: row?.count ?? 0, limit: PUSH_LIMIT };
}
