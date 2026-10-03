import { connectDb } from "@/lib/db/mongoose";

import { fetchFriendship } from "./friendship";
import { LineLink } from "./model";

/** At most this many users may have reminders switched on (the free LINE quota is small). */
export const REMINDER_CAP = 10;

export type FriendshipProbe = (accessToken: string) => Promise<boolean | undefined>;

export type LineStatus =
  | { linked: false }
  | {
      linked: true;
      /** The user is a friend of the bot, so a push can reach them. */
      friend: boolean;
      /** The user's own switch; on only while they hold one of the slots. */
      switchedOn: boolean;
      /** Reminders are really sent: linked, a friend, switched on and within the cap. */
      remindersOn: boolean;
    };

export type SetRemindersOutcome = { kind: "ok" } | { kind: "not-linked" } | { kind: "full" };

export type ReminderRecipient = { userId: string; lineUserId: string };

const DUPLICATE_KEY = 11000;

function isDuplicateKey(error: unknown): boolean {
  return (
    typeof error === "object" && error !== null && "code" in error && error.code === DUPLICATE_KEY
  );
}

let indexes: Promise<unknown> | null = null;

// Every function starts here: the cap below rests on the unique indexes, so they must exist
// before the first write.
async function ready(): Promise<void> {
  await connectDb();
  const building = (indexes ??= LineLink.createIndexes());
  try {
    await building;
  } catch (error) {
    if (indexes === building) indexes = null;
    throw error;
  }
}

function holdsSlot(slot: number | null | undefined): boolean {
  return typeof slot === "number" && slot >= 1 && slot <= REMINDER_CAP;
}

const HOLDS_SLOT = { $gte: 1, $lte: REMINDER_CAP };

/**
 * Take a free reminder slot for a linked user. There is no counter to race on: slot numbers 1 to
 * the cap are unique in the collection, so two users asking for the same slot at the same moment
 * cannot both get it; the loser gets a duplicate-key error and tries the next number. When every
 * number is taken the user is refused.
 */
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

/**
 * Record that a LINE account is attached to an app user. Better Auth calls this when the account
 * is linked and again on every LINE sign-in, so it is also what repairs a row that went missing.
 *
 * The friend flag is read from LINE here because the `follow` webhook cannot be relied on for it:
 * a visitor who adds the bot while signing in triggers that event before their account exists,
 * and someone may have been a friend of the bot long before linking.
 *
 * A new link starts with reminders switched on when a slot is free.
 */
export async function recordLineAccount(
  account: { userId: string; lineUserId: string; accessToken?: string },
  probe: FriendshipProbe = fetchFriendship,
): Promise<void> {
  await ready();
  const { userId, lineUserId } = account;
  const probed = account.accessToken ? await probe(account.accessToken) : undefined;

  // Better Auth lets a LINE account belong to one user only, so any other row is stale.
  await LineLink.deleteMany({ lineUserId, userId: { $ne: userId } });

  const existing = await LineLink.findOne({ userId }).lean();
  if (existing?.lineUserId === lineUserId) {
    if (probed !== undefined) await LineLink.updateOne({ userId }, { $set: { friend: probed } });
    return;
  }
  if (existing) {
    // The user linked a different LINE account: what was known about the old one no longer holds.
    await LineLink.updateOne(
      { userId },
      { $set: { lineUserId, friend: probed ?? false, friendEventAt: null } },
    );
    return;
  }

  try {
    await LineLink.create({ userId, lineUserId, friend: probed ?? false });
  } catch (error) {
    // Linked twice at the same moment: the other call created the row.
    if (!isDuplicateKey(error)) throw error;
    return;
  }
  await claimSlot(userId);
}

export async function removeLineLink(userId: string): Promise<void> {
  await ready();
  await LineLink.deleteOne({ userId });
}

export async function getLineStatus(userId: string): Promise<LineStatus> {
  await ready();
  const link = await LineLink.findOne({ userId }).lean();
  if (!link) return { linked: false };
  const switchedOn = holdsSlot(link.reminderSlot);
  return { linked: true, friend: link.friend, switchedOn, remindersOn: link.friend && switchedOn };
}

/** The one answer to "does this user get reminders": linked, a friend, switched on, within the cap. */
export async function areRemindersOn(userId: string): Promise<boolean> {
  await ready();
  return (await LineLink.exists({ userId, friend: true, reminderSlot: HOLDS_SLOT })) !== null;
}

/**
 * Flip the user's reminder switch. Switching on takes one of the slots, and the user who would be
 * the eleventh is refused with `full`; switching off gives the slot back.
 */
export async function setReminders(userId: string, on: boolean): Promise<SetRemindersOutcome> {
  await ready();
  if (!on) {
    const { matchedCount } = await LineLink.updateOne({ userId }, { $set: { reminderSlot: null } });
    return matchedCount === 1 ? { kind: "ok" } : { kind: "not-linked" };
  }
  const claim = await claimSlot(userId);
  return claim === "claimed" ? { kind: "ok" } : { kind: claim };
}

/**
 * Apply a `follow` (true) or `unfollow` (false) webhook event that happened at `at`. Returns false
 * when nothing changed: nobody has linked this LINE user, or a newer event was already applied.
 */
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

/** The app user who linked this LINE user id, for answering a message sent to the bot. */
export async function findUserIdByLineUserId(lineUserId: string): Promise<string | null> {
  await ready();
  const link = await LineLink.findOne({ lineUserId }).lean();
  return link?.userId ?? null;
}

/** Every user reminders are on for, with the LINE user id to push to. */
export async function listReminderRecipients(): Promise<ReminderRecipient[]> {
  await ready();
  const links = await LineLink.find({ friend: true, reminderSlot: HOLDS_SLOT }).lean();
  return links.map(({ userId, lineUserId }) => ({ userId, lineUserId }));
}
