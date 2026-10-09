import { readFile } from "node:fs/promises";

import { MongoClient, type Db } from "mongodb";

export async function withDb<T>(run: (db: Db) => Promise<T>): Promise<T> {
  const client = new MongoClient(await readFile(".e2e/mongo-uri", "utf8"));
  try {
    await client.connect();
    return await run(client.db());
  } finally {
    await client.close();
  }
}

export async function userIdOf(db: Db, email: string): Promise<string> {
  const user = await db.collection("user").findOne({ email });
  if (!user) throw new Error(`No user with the email ${email}`);
  return user._id.toHexString();
}

function lineLinkRow(userId: string, lineUserId: string, reminderSlot: number | null, now: Date) {
  return {
    userId,
    lineUserId,
    friend: true,
    friendEventAt: null,
    reminderSlot,
    createdAt: now,
    updatedAt: now,
  };
}

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
    const userId = user._id.toHexString();
    await db
      .collection("linelinks")
      .insertOne(lineLinkRow(userId, lineUserId, options.reminderSlot, now));
    return { userId, lineUserId };
  });
}

export async function seedSubscriber(name: string, reminderSlot: number, shows: string[]) {
  return withDb(async (db) => {
    const now = new Date();
    const userId = `e2e-subscriber-${name}-${now.getTime()}`;
    const lineUserId = `U-${userId}`;
    await db.collection("linelinks").insertOne(lineLinkRow(userId, lineUserId, reminderSlot, now));
    if (shows.length) {
      await db
        .collection("follows")
        .insertMany(shows.map((showRoute) => ({ userId, showRoute, createdAt: now })));
    }
    return lineUserId;
  });
}

export async function removeLineLinks(lineUserIds: string[]) {
  await withDb(async (db) => {
    await db.collection("linelinks").deleteMany({ lineUserId: { $in: lineUserIds } });
  });
}

export async function fillReminderSlots(firstSlot: number) {
  await withDb(async (db) => {
    const now = new Date();
    const links = [];
    for (let slot = firstSlot; slot <= 10; slot++) {
      const userId = `e2e-filler-${slot}-${now.getTime()}`;
      links.push(lineLinkRow(userId, `U-${userId}`, slot, now));
    }
    await db.collection("linelinks").insertMany(links);
  });
}

export async function clearFillers() {
  await withDb(async (db) => {
    await db.collection("linelinks").deleteMany({ userId: /^e2e-filler-/ });
  });
}

export async function makeAdmin(email: string) {
  await withDb(async (db) => {
    const { matchedCount } = await db
      .collection("user")
      .updateOne({ email }, { $set: { role: "admin" } });
    if (matchedCount !== 1) throw new Error(`No user with the email ${email}`);
  });
}

const SEEDED_SYNC_SOURCE = "e2e-seeded";

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

export async function clearSeededSyncs() {
  await withDb(async (db) => {
    await db.collection("schedulesyncruns").deleteMany({ source: SEEDED_SYNC_SOURCE });
  });
}

export async function chooseDashboardView(email: string, dashboardView: "feature" | "index") {
  await withDb(async (db) => {
    const userId = await userIdOf(db, email);
    await db
      .collection("preferences")
      .updateOne({ userId }, { $set: { dashboardView } }, { upsert: true });
  });
}
