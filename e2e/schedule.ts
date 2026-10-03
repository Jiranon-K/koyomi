import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

import { withDb } from "./seed";

export async function syncSchedule(request: APIRequestContext, scenario: "base" | "revised") {
  const response = await request.post("/api/dev/sync-schedule", { data: { scenario } });
  expect(response.status()).toBe(200);
}

export async function followBehindTheServer(email: string, showRoute: string) {
  await withDb(async (db) => {
    const user = await db.collection("user").findOne({ email });
    if (!user) throw new Error(`No account for ${email}`);
    await db
      .collection("follows")
      .insertOne({ userId: user._id.toString(), showRoute, createdAt: new Date() });
  });
}

export async function renameShowBehindTheServer(route: string, title: string) {
  const { matchedCount } = await withDb((db) =>
    db.collection("shows").updateOne({ route }, { $set: { title } }),
  );
  expect(matchedCount).toBe(1);
}
