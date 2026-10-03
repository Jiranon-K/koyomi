import { readFile } from "node:fs/promises";

import { MongoClient, type Db } from "mongodb";

// LINE Login cannot be driven by a test, so the linked state is written straight into the
// database the end-to-end server uses (e2e/server.mjs leaves its address in .e2e/mongo-uri).
// The shapes mirror what the app writes: a Better Auth `account` row for the LINE provider, and
// the app's own row in `linelinks` (src/features/line/model.ts). Change them together.

async function withDb<T>(run: (db: Db) => Promise<T>): Promise<T> {
  const client = new MongoClient(await readFile(".e2e/mongo-uri", "utf8"));
  try {
    await client.connect();
    return await run(client.db());
  } finally {
    await client.close();
  }
}

/**
 * Give the account with this email a linked LINE account that is a friend of the bot. Returns the app
 * user id and the LINE user id.
 */
export async function linkLine(email: string, options: { reminderSlot: number | null }) {
  return withDb(async (db) => {
    const user = await db.collection("user").findOne({ email });
    if (!user) throw new Error(`No user with the email ${email}`);
    const now = new Date();
    const lineUserId = `U-e2e-${user._id.toHexString()}`;
    await db.collection("account").insertOne({
      accountId: lineUserId,
      providerId: "line",
      userId: user._id,
      createdAt: now,
      updatedAt: now,
    });
    await db.collection("linelinks").insertOne({
      userId: user._id.toHexString(),
      lineUserId,
      friend: true,
      friendEventAt: null,
      reminderSlot: options.reminderSlot,
      createdAt: now,
      updatedAt: now,
    });
    return { userId: user._id.toHexString(), lineUserId };
  });
}

/**
 * A user that exists only as data: linked to LINE, a friend of the bot, reminders on, following
 * `shows`. Enough for the digest, which never looks at the account itself. Returns the LINE user id.
 */
export async function seedSubscriber(name: string, reminderSlot: number, shows: string[]) {
  return withDb(async (db) => {
    const now = new Date();
    const userId = `e2e-subscriber-${name}-${now.getTime()}`;
    const lineUserId = `U-${userId}`;
    await db.collection("linelinks").insertOne({
      userId,
      lineUserId,
      friend: true,
      friendEventAt: null,
      reminderSlot,
      createdAt: now,
      updatedAt: now,
    });
    if (shows.length) {
      await db
        .collection("follows")
        .insertMany(shows.map((showRoute) => ({ userId, showRoute, createdAt: now })));
    }
    return lineUserId;
  });
}

/** Remove the LINE links these LINE users hold, and with them their reminder places. */
export async function removeLineLinks(lineUserIds: string[]) {
  await withDb(async (db) => {
    await db.collection("linelinks").deleteMany({ lineUserId: { $in: lineUserIds } });
  });
}

/** Other users take every reminder place from `firstSlot` up to the cap of ten. */
export async function fillReminderSlots(firstSlot: number) {
  await withDb(async (db) => {
    const now = new Date();
    const links = [];
    for (let slot = firstSlot; slot <= 10; slot++) {
      links.push({
        userId: `e2e-filler-${slot}-${now.getTime()}`,
        lineUserId: `U-e2e-filler-${slot}-${now.getTime()}`,
        friend: true,
        friendEventAt: null,
        reminderSlot: slot,
        createdAt: now,
        updatedAt: now,
      });
    }
    await db.collection("linelinks").insertMany(links);
  });
}

/** Remove every reminder place the fillers took. */
export async function clearFillers() {
  await withDb(async (db) => {
    await db.collection("linelinks").deleteMany({ userId: /^e2e-filler-/ });
  });
}

/**
 * Turn an existing account into an administrator. Roles are normally set once, at sign-up, from
 * `ADMIN_EMAILS`, which the end-to-end server leaves empty; the session reads the role from the
 * `user` row on every request, so the open browser session is an admin's from the next page on.
 */
export async function makeAdmin(email: string) {
  await withDb(async (db) => {
    const { matchedCount } = await db
      .collection("user")
      .updateOne({ email }, { $set: { role: "admin" } });
    if (matchedCount !== 1) throw new Error(`No user with the email ${email}`);
  });
}

const SEEDED_SYNC_SOURCE = "e2e-seeded";

/**
 * Record a schedule sync that failed just now with this reason, as the app would (the
 * `schedulesyncruns` collection of src/features/schedule/model.ts). The fake source never fails,
 * so this is how the failed state gets on screen.
 */
export async function seedFailedSync(error: string) {
  await withDb(async (db) => {
    const now = new Date();
    await db.collection("schedulesyncruns").insertOne({
      startedAt: now,
      finishedAt: now,
      outcome: "failure",
      source: SEEDED_SYNC_SOURCE,
      requests: 0,
      shows: 0,
      episodes: 0,
      skipped: 0,
      error,
    });
  });
}

/** Remove every sync run `seedFailedSync` recorded. */
export async function clearSeededSyncs() {
  await withDb(async (db) => {
    await db.collection("schedulesyncruns").deleteMany({ source: SEEDED_SYNC_SOURCE });
  });
}
