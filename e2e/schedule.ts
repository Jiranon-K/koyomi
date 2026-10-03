import { readFile } from "node:fs/promises";

import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
import { MongoClient } from "mongodb";

/** Runs the schedule sync on the end-to-end server with the fake source. Safe to repeat. */
export async function syncSchedule(request: APIRequestContext, scenario: "base" | "revised") {
  const response = await request.post("/api/dev/sync-schedule", { data: { scenario } });
  expect(response.status()).toBe(200);
}

/** Makes an account follow a show without the UI, for a show the schedule no longer lists. */
export async function followBehindTheServer(email: string, showRoute: string) {
  const client = await MongoClient.connect(await readFile(".e2e/mongo-uri", "utf8"));
  try {
    const user = await client.db().collection("user").findOne({ email });
    if (!user) throw new Error(`No account for ${email}`);
    await client
      .db()
      .collection("follows")
      .insertOne({ userId: user._id.toString(), showRoute, createdAt: new Date() });
  } finally {
    await client.close();
  }
}

/** Renames a show directly in the database, bypassing the server and so its data cache. */
export async function renameShowBehindTheServer(route: string, title: string) {
  const client = await MongoClient.connect(await readFile(".e2e/mongo-uri", "utf8"));
  try {
    const { matchedCount } = await client
      .db()
      .collection("shows")
      .updateOne({ route }, { $set: { title } });
    expect(matchedCount).toBe(1);
  } finally {
    await client.close();
  }
}
