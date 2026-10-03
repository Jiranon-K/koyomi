import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Preference } from "./model";
import { getDashboardView, setDashboardView } from "./service";

const ADA = "user-ada";
const BOB = "user-bob";
const saved = { ...process.env };

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("preferences-test");
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await getDashboardView(ADA);
  await Preference.deleteMany({});
});

describe("the dashboard view preference", () => {
  it("is the feature view for a user who never chose", async () => {
    expect(await getDashboardView(ADA)).toBe("feature");
  });

  it("is what the user last chose", async () => {
    await setDashboardView(ADA, "index");
    expect(await getDashboardView(ADA)).toBe("index");

    await setDashboardView(ADA, "feature");
    expect(await getDashboardView(ADA)).toBe("feature");
  });

  it("belongs to one user only", async () => {
    await setDashboardView(ADA, "index");

    expect(await getDashboardView(BOB)).toBe("feature");
  });

  it("keeps one row per user, even when set twice at the same moment", async () => {
    await Promise.all([setDashboardView(ADA, "index"), setDashboardView(ADA, "index")]);

    expect(await Preference.countDocuments({ userId: ADA })).toBe(1);
    expect(await getDashboardView(ADA)).toBe("index");
  });
});
