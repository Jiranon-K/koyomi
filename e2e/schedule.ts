import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";

import { userIdOf, withDb } from "./seed";

export async function syncSchedule(request: APIRequestContext, scenario: "base" | "revised") {
  const response = await request.post("/api/dev/sync-schedule", { data: { scenario } });
  expect(response.status()).toBe(200);
}

export async function followBehindTheServer(email: string, showRoute: string) {
  await withDb(async (db) => {
    const userId = await userIdOf(db, email);
    await db.collection("follows").insertOne({ userId, showRoute, createdAt: new Date() });
  });
}

export async function renameShowBehindTheServer(route: string, title: string) {
  const { matchedCount } = await withDb((db) =>
    db.collection("shows").updateOne({ route }, { $set: { title } }),
  );
  expect(matchedCount).toBe(1);
}
