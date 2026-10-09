import { indexesReady, isDuplicateKey } from "@/lib/db/mongoose";

import { fetchFriendship } from "./friendship";
import { LineLink } from "./model";

export const REMINDER_CAP = 10;

export type FriendshipProbe = (accessToken: string) => Promise<boolean | undefined>;

export type LineStatus =
  | { linked: false }
  | {
      linked: true;
      friend: boolean;
      switchedOn: boolean;
      remindersOn: boolean;
    };

export type SetRemindersOutcome = { kind: "ok" } | { kind: "not-linked" } | { kind: "full" };

export type ReminderRecipient = { userId: string; lineUserId: string };

export type ReminderPlaces = {
  taken: number;
  reachable: number;
  cap: number;
};

const ready = indexesReady(() => LineLink.createIndexes());

function holdsSlot(slot: number | null | undefined): boolean {
  return typeof slot === "number" && slot >= 1 && slot <= REMINDER_CAP;
}

const HOLDS_SLOT = { $gte: 1, $lte: REMINDER_CAP };
const REMINDERS_ON = { friend: true, reminderSlot: HOLDS_SLOT };

async function claimSlot(userId: string): Promise<"claimed" | "full" | "not-linked"> {
  for (let slot = 1; slot <= REMINDER_CAP; slot++) {
    try {
      const { matchedCount } = await LineLink.updateOne(
        { userId, reminderSlot: null },
        { $set: { reminderSlot: slot } },
      );
      if (matchedCount === 1) return "claimed";
      const link = await LineLink.findOne({ userId }).lean();
      if (!link) return "not-linked";
      if (holdsSlot(link.reminderSlot)) return "claimed";
    } catch (error) {
      if (!isDuplicateKey(error)) throw error;
    }
  }
  return "full";
}

export async function recordLineAccount(
  account: { userId: string; lineUserId: string; accessToken?: string },
  probe: FriendshipProbe = fetchFriendship,
): Promise<void> {
  await ready();
  const { userId, lineUserId } = account;
  const probing = account.accessToken ? probe(account.accessToken) : undefined;

  const [existing, probed] = await Promise.all([
    LineLink.findOne({ userId }).lean(),
    probing,
    LineLink.deleteMany({ lineUserId, userId: { $ne: userId } }),
  ]);
  if (existing?.lineUserId === lineUserId) {
    if (probed !== undefined) await LineLink.updateOne({ userId }, { $set: { friend: probed } });
    return;
  }
  if (existing) {
    await LineLink.updateOne(
      { userId },
      { $set: { lineUserId, friend: probed ?? false, friendEventAt: null } },
    );
    return;
  }

  try {
    await LineLink.create({ userId, lineUserId, friend: probed ?? false });
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    return;
  }
  await claimSlot(userId);
}

export async function removeLineLink(userId: string, lineUserId?: string): Promise<void> {
  await ready();
  await LineLink.deleteOne({ userId, ...(lineUserId ? { lineUserId } : {}) });
}

export async function getLineStatus(userId: string): Promise<LineStatus> {
  await ready();
  const link = await LineLink.findOne({ userId }).lean();
  if (!link) return { linked: false };
  const switchedOn = holdsSlot(link.reminderSlot);
  return { linked: true, friend: link.friend, switchedOn, remindersOn: link.friend && switchedOn };
}

export async function areRemindersOn(userId: string): Promise<boolean> {
  return (await findReminderRecipient(userId)) !== null;
}

export async function setReminders(userId: string, on: boolean): Promise<SetRemindersOutcome> {
  await ready();
  if (!on) {
    const { matchedCount } = await LineLink.updateOne({ userId }, { $set: { reminderSlot: null } });
    return matchedCount === 1 ? { kind: "ok" } : { kind: "not-linked" };
  }
  const claim = await claimSlot(userId);
  return claim === "claimed" ? { kind: "ok" } : { kind: claim };
}

export async function setFriendByLineUserId(
  lineUserId: string,
  friend: boolean,
  at: Date,
): Promise<boolean> {
  await ready();
  const { matchedCount } = await LineLink.updateOne(
    { lineUserId, $or: [{ friendEventAt: null }, { friendEventAt: { $lt: at } }] },
    { $set: { friend, friendEventAt: at } },
  );
  return matchedCount === 1;
}

export async function findUserIdByLineUserId(lineUserId: string): Promise<string | null> {
  await ready();
  const link = await LineLink.findOne({ lineUserId }).lean();
  return link?.userId ?? null;
}

export async function listReminderRecipients(): Promise<ReminderRecipient[]> {
  await ready();
  const links = await LineLink.find(REMINDERS_ON).lean();
  return links.map(({ userId, lineUserId }) => ({ userId, lineUserId }));
}

export async function findReminderRecipient(userId: string): Promise<ReminderRecipient | null> {
  await ready();
  const link = await LineLink.findOne({ userId, ...REMINDERS_ON }).lean();
  return link ? { userId: link.userId, lineUserId: link.lineUserId } : null;
}

export async function reminderPlaces(): Promise<ReminderPlaces> {
  await ready();
  const [taken, reachable] = await Promise.all([
    LineLink.countDocuments({ reminderSlot: HOLDS_SLOT }),
    LineLink.countDocuments(REMINDERS_ON),
  ]);
  return { taken, reachable, cap: REMINDER_CAP };
}
