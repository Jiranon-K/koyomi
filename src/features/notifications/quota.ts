import type { LineMessenger } from "@/features/line/messenger";
import { calendarMonthOf } from "@/features/schedule/day-window";
import { isDuplicateKey } from "@/lib/db/mongoose";

import { PushQuota, ready } from "./model";

export const PUSH_LIMIT = 290;

export type PushOutcome =
  { kind: "sent" } | { kind: "refused-quota" } | { kind: "failed"; error: string };

export type PushCount = { month: string; count: number; limit: number };

export const quotaMonth = calendarMonthOf;

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
      if (!isDuplicateKey(error)) throw error;
    }
    const row = await PushQuota.findOne({ month })
      .select({ count: 1, keys: { $elemMatch: { $eq: key } } })
      .lean();
    if (row?.keys?.length) return "held";
    if (row && row.count >= PUSH_LIMIT) return "refused";
  }
  throw new Error("The push quota could not be reserved.");
}

async function release(month: string, key: string): Promise<void> {
  await PushQuota.updateOne({ month, keys: key }, { $inc: { count: -1 }, $pull: { keys: key } });
}

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

export async function pushesThisMonth(now: Date = new Date()): Promise<PushCount> {
  await ready();
  const month = quotaMonth(now);
  const row = await PushQuota.findOne({ month }).select({ count: 1 }).lean();
  return { month, count: row?.count ?? 0, limit: PUSH_LIMIT };
}
