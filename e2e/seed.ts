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

/** Give the account with this email a linked LINE account that is a friend of the bot. */
export async function linkLine(email: string, options: { reminderSlot: number | null }) {
  await withDb(async (db) => {
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
