import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { Follow } from "@/features/follows/model";
import { followShow } from "@/features/follows/service";
import { pushesInLineLog } from "@/features/line/fake-messenger";
import { LineLink } from "@/features/line/model";
import { recordLineAccount } from "@/features/line/service";
import { dayWindowOf } from "@/features/schedule/day-window";
import { Episode, Show, SyncRun } from "@/features/schedule/model";
import { lastSyncRun } from "@/features/schedule/service";

import { lastDigestRun } from "./digest";
import { handleJobRequest } from "./job-route";
import { jobQueue, runJob } from "./jobs";
import { DigestDelivery, DigestRun, PushQuota } from "./model";
import { jobUrl } from "./queue";
import { pushesThisMonth } from "./quota";
import { signJob } from "./test-helpers";

const mocks = vi.hoisted(() => ({ revalidateTag: vi.fn() }));

vi.mock("next/cache", () => ({
  revalidateTag: mocks.revalidateTag,
  unstable_cache: (load: unknown) => load,
}));

const APP = "https://koyomi.example";
const KEY = "test-current-signing-key";
const saved = { ...process.env };

let server: MongoMemoryServer;
let log: ReturnType<typeof vi.spyOn>;

const today = () => dayWindowOf(new Date()).day;
const logged = () => log.mock.calls.map(String).join("\n");

async function subscriber(name: string, shows: string[]) {
  const userId = `user-${name}`;
  await recordLineAccount(
    { userId, lineUserId: `U-${name}`, accessToken: "token" },
    async () => true,
  );
  for (const show of shows) expect(await followShow(userId, show)).toBe("followed");
  return userId;
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  process.env = {
    ...saved,
    MONGODB_URI: server.getUri("jobs-test"),
    USE_FAKES: "true",
    BETTER_AUTH_SECRET: "test-secret-test-secret-test-secret-1234",
    BETTER_AUTH_URL: APP,
  };
  delete process.env.QSTASH_TOKEN;
  delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  vi.restoreAllMocks();
  mocks.revalidateTag.mockClear();
  log = vi.spyOn(console, "log").mockImplementation(() => undefined);

  await lastDigestRun(); // connects
  await Promise.all([
    Follow.deleteMany({}),
    LineLink.deleteMany({}),
    Show.deleteMany({}),
    Episode.deleteMany({}),
    SyncRun.deleteMany({}),
    DigestDelivery.deleteMany({}),
    DigestRun.deleteMany({}),
    PushQuota.deleteMany({}),
  ]);
});

describe("the sync job", () => {
  it("runs the schedule sync and expires the cached schedule", async () => {
    const result = await runJob("sync-schedule", {});

    expect(result).toMatchObject({ status: "ran", retry: false, result: { outcome: "success" } });
    expect(await lastSyncRun("success")).toMatchObject({ source: "fake" });
    expect(mocks.revalidateTag).toHaveBeenCalledOnce();
  });

  it("asks for a retry when the sync fails", async () => {
    process.env.USE_FAKES = "false"; // the real source, and no token

    const result = await runJob("sync-schedule", {});

    expect(result).toMatchObject({ status: "ran", retry: true, result: { outcome: "failure" } });
    expect(await lastSyncRun()).toMatchObject({ outcome: "failure" });
  });
});

describe("the digest jobs with the fakes on", () => {
  it("fan out through the in-process queue and write each digest to the server log", async () => {
    await runJob("sync-schedule", {});
    const ada = await subscriber("ada", ["lantern-street-diaries", "clockwork-orchard"]);
    await subscriber("quiet", ["moss-and-thunder"]);

    const result = await runJob("digest-fanout", {});

    expect(result).toEqual({
      status: "ran",
      retry: false,
      result: { outcome: "enqueued", day: today(), recipients: 2, enqueued: 1 },
    });
    const pushes = pushesInLineLog(logged(), "U-ada");
    expect(pushes).toHaveLength(1);
    expect(pushes[0]?.text).toBe(
      [
        "Airing today (Thai time):",
        "22:30 Lantern Street Diaries, episode 5",
        "00:30 Clockwork Orchard, episode 3",
        "",
        `Your week: ${APP}/dashboard`,
      ].join("\n"),
    );
    expect(pushesInLineLog(logged(), "U-quiet")).toEqual([]);
    expect(await DigestDelivery.find({}).lean()).toMatchObject([{ userId: ada, status: "sent" }]);
    expect(await pushesThisMonth()).toMatchObject({ count: 1 });
  });

  it("send each digest once when the fan-out runs again", async () => {
    await runJob("sync-schedule", {});
    await subscriber("ada", ["lantern-street-diaries"]);

    await runJob("digest-fanout", {});
    await runJob("digest-fanout", {});

    expect(pushesInLineLog(logged(), "U-ada")).toHaveLength(1);
    expect(await pushesThisMonth()).toMatchObject({ count: 1 });
    expect(await DigestRun.countDocuments({ outcome: "enqueued" })).toBe(2);
  });

  it("skip, and record it, while the schedule has never been synced", async () => {
    await subscriber("ada", []);

    const result = await runJob("digest-fanout", {});

    expect(result).toMatchObject({
      status: "ran",
      retry: false,
      result: { outcome: "skipped-stale" },
    });
    expect(await lastDigestRun()).toMatchObject({ outcome: "skipped-stale" });
  });
});

describe("the per-user digest job", () => {
  it.each([
    ["no payload", {}],
    ["no user", { day: "2026-10-03" }],
    ["an empty user", { userId: "", day: "2026-10-03" }],
    ["a day in another format", { userId: "user-ada", day: "03/10/2026" }],
    ["a day that does not exist", { userId: "user-ada", day: "2026-02-30" }],
    ["a query operator as the user", { userId: { $ne: "" }, day: "2026-10-03" }],
    ["something that is not an object", "user-ada"],
  ])("rejects %s without touching anything", async (_, payload) => {
    expect(await runJob("digest-send", payload)).toEqual({ status: "invalid" });
    expect(await DigestDelivery.countDocuments({})).toBe(0);
  });

  it("asks for a retry when the push fails, and for none when it is refused or done", async () => {
    await runJob("sync-schedule", {});
    const ada = await subscriber("ada", ["lantern-street-diaries"]);
    const target = { userId: ada, day: today() };

    process.env.USE_FAKES = "false"; // the real sender, with no access token: every push fails
    expect(await runJob("digest-send", target)).toEqual({
      status: "ran",
      retry: true,
      result: { outcome: "failed" },
    });
    expect(await DigestDelivery.findOne({ userId: ada }).lean()).toMatchObject({
      status: "failed",
      error: "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not set.",
    });
    expect(await pushesThisMonth()).toMatchObject({ count: 0 });

    process.env.USE_FAKES = "true";
    expect(await runJob("digest-send", target)).toMatchObject({
      retry: false,
      result: { outcome: "sent" },
    });
    expect(await runJob("digest-send", target)).toMatchObject({
      retry: false,
      result: { outcome: "already-sent" },
    });
    expect(pushesInLineLog(logged(), "U-ada")).toHaveLength(1);
  });
});

describe("the job Route Handler with the real jobs behind it", () => {
  const body = () => JSON.stringify({ userId: "user-ada", day: today() });
  const keys = { currentSigningKey: KEY, nextSigningKey: "test-next-signing-key" };

  function post(job: "digest-send" | "digest-fanout", payload: string, signature: string | null) {
    const request = new Request(jobUrl(APP, job), {
      method: "POST",
      headers: signature === null ? {} : { "upstash-signature": signature },
      body: payload,
    });
    return handleJobRequest(request, job, { signingKeys: keys });
  }

  it("sends the digest for a signed call and nothing for an unsigned or forged one", async () => {
    await runJob("sync-schedule", {});
    await subscriber("ada", ["lantern-street-diaries"]);
    const url = jobUrl(APP, "digest-send");

    const unsigned = await post("digest-send", body(), null);
    const forged = await post("digest-send", body(), signJob({ key: "wrong", url, body: body() }));
    expect([unsigned.status, forged.status]).toEqual([401, 401]);
    expect(pushesInLineLog(logged(), "U-ada")).toEqual([]);
    expect(await DigestDelivery.countDocuments({})).toBe(0);

    const signed = await post("digest-send", body(), signJob({ key: KEY, url, body: body() }));
    expect(signed.status).toBe(200);
    expect(await signed.json()).toEqual({ outcome: "sent" });
    expect(pushesInLineLog(logged(), "U-ada")).toHaveLength(1);
  });

  it("does not fan out for an unsigned call", async () => {
    await runJob("sync-schedule", {});
    await subscriber("ada", ["lantern-street-diaries"]);

    expect((await post("digest-fanout", "", null)).status).toBe(401);

    expect(await DigestRun.countDocuments({})).toBe(0);
    expect(pushesInLineLog(logged(), "U-ada")).toEqual([]);
  });
});

describe("jobQueue", () => {
  it("is the in-process queue with the fakes on", () => {
    expect(jobQueue().name).toBe("in-process");
  });

  it("is QStash otherwise, and names the missing token", () => {
    process.env.USE_FAKES = "false";

    expect(() => jobQueue()).toThrow(/QSTASH_TOKEN is not set/);
    process.env.QSTASH_TOKEN = "test-qstash-token";
    expect(jobQueue().name).toBe("qstash");
  });
});
