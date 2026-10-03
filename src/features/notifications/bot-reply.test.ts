import { createHmac } from "node:crypto";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { POST } from "@/app/api/line/webhook/route";
import { Follow } from "@/features/follows/model";
import { followShow } from "@/features/follows/service";
import { repliesInLineLog } from "@/features/line/fake-messenger";
import type { LineMessenger, SendResult } from "@/features/line/messenger";
import { LineLink } from "@/features/line/model";
import { getLineStatus, recordLineAccount } from "@/features/line/service";
import { handleLineWebhook } from "@/features/line/webhook";
import { createFakeSource } from "@/features/schedule/fake-source";
import { Episode, Show, SyncRun } from "@/features/schedule/model";
import { syncSchedule } from "@/features/schedule/service";

import { botEventHandlers } from "./bot-reply";
import { PushQuota } from "./model";
import { pushesThisMonth } from "./quota";
import { LINE_TEXT_LIMIT, USAGE_REPLY } from "./reply-text";

// Saturday 3 October 2026, 09:00 in Bangkok.
const NOW = new Date("2026-10-03T02:00:00Z");
const CHANNEL_SECRET = "test-messaging-channel-secret";
const ENDPOINT = "http://localhost:3000/api/line/webhook";
const SETTINGS = "https://koyomi.example/settings";
const saved = { ...process.env };

// In the fake schedule, relative to NOW: Lantern Street Diaries airs today at 22:30 and Clockwork
// Orchard at 00:30 after midnight, Salt and Starlight tomorrow (delayed), Moss and Thunder in six
// days at 05:00, and the next Lantern Street Diaries episode in seven days, outside the week.
const TODAY_SHOW = "lantern-street-diaries";
const LATE_SHOW = "clockwork-orchard";
const DELAYED_SHOW = "salt-and-starlight";
const LAST_DAY_SHOW = "moss-and-thunder";
const OTHER_SHOW = "the-ninth-platform";

let server: MongoMemoryServer;

function sign(body: string): string {
  return createHmac("sha256", CHANNEL_SECRET).update(body).digest("base64");
}

function signedRequest(events: unknown[], signature?: string): Request {
  const body = JSON.stringify({ destination: "U-bot", events });
  return new Request(ENDPOINT, {
    method: "POST",
    headers: { "content-type": "application/json", "x-line-signature": signature ?? sign(body) },
    body,
  });
}

let tokens = 0;

/** A text message event from one LINE user, with a reply token of its own. */
function textFrom(lineUserId: string, text: string) {
  return {
    type: "message",
    timestamp: NOW.getTime(),
    source: { type: "user", userId: lineUserId },
    replyToken: `reply-token-${++tokens}`,
    message: { type: "text", id: "1", text },
  };
}

/** A sender that records what it was asked to send and answers a reply as told. */
function recordingMessenger(answer: () => SendResult | Promise<SendResult> = () => ({ ok: true })) {
  const replies: { replyToken: string; text: string }[] = [];
  const pushed: string[] = [];
  const messenger: LineMessenger = {
    name: "fake",
    async push(lineUserId) {
      pushed.push(lineUserId);
      return { ok: true };
    },
    async reply(replyToken, text) {
      replies.push({ replyToken, text });
      return answer();
    },
  };
  return { messenger, replies, pushed };
}

/** Posts a correctly signed delivery to the webhook, the bot answering through `messenger`. */
function deliver(events: unknown[], messenger: LineMessenger, signature?: string) {
  return handleLineWebhook(signedRequest(events, signature), {
    channelSecret: CHANNEL_SECRET,
    handlers: botEventHandlers({ messenger, now: () => NOW, settingsUrl: SETTINGS }),
  });
}

/** Sends one text to the bot and returns the texts it replied with. */
async function ask(lineUserId: string, text: string): Promise<string[]> {
  const { messenger, replies } = recordingMessenger();
  const response = await deliver([textFrom(lineUserId, text)], messenger);
  expect(response.status).toBe(200);
  return replies.map((reply) => reply.text);
}

/** A user who linked LINE and follows `shows`. */
async function linked(name: string, shows: string[]) {
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
  process.env.MONGODB_URI = server.getUri("bot-reply-test");
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await getLineStatus("nobody"); // connects
  await Promise.all([
    Follow.deleteMany({}),
    LineLink.deleteMany({}),
    Show.deleteMany({}),
    Episode.deleteMany({}),
    SyncRun.deleteMany({}),
    PushQuota.deleteMany({}),
  ]);
  await syncSchedule(createFakeSource(), NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("the bot's answer to `today`", () => {
  it("is the sender's followed episodes of today's schedule day, in the digest's line format", async () => {
    await linked("ada", [TODAY_SHOW, LATE_SHOW, DELAYED_SHOW]);
    await linked("bob", [OTHER_SHOW]);

    expect(await ask("U-ada", "today")).toEqual([
      [
        "Airing today (Thai time):",
        "22:30 Lantern Street Diaries, episode 5",
        "00:30 Clockwork Orchard, episode 3",
      ].join("\n"),
    ]);
  });

  it("goes to the reply token of the message it answers", async () => {
    await linked("ada", [TODAY_SHOW]);
    const { messenger, replies } = recordingMessenger();
    const message = textFrom("U-ada", "today");

    await deliver([message], messenger);

    expect(replies.map((reply) => reply.replyToken)).toEqual([message.replyToken]);
  });

  it("says so when nothing the sender follows airs today", async () => {
    await linked("ada", [DELAYED_SHOW]);
    await linked("bob", []);

    expect(await ask("U-ada", "today")).toEqual(["Nothing you follow airs today."]);
    expect(await ask("U-bob", "today")).toEqual(["Nothing you follow airs today."]);
  });

  it("marks a delayed episode", async () => {
    await linked("ada", [DELAYED_SHOW]);
    // Sunday 4 October, 09:00 in Bangkok: the delayed episode's day.
    const { messenger, replies } = recordingMessenger();

    await handleLineWebhook(signedRequest([textFrom("U-ada", "today")]), {
      channelSecret: CHANNEL_SECRET,
      handlers: botEventHandlers({
        messenger,
        now: () => new Date("2026-10-04T02:00:00Z"),
        settingsUrl: SETTINGS,
      }),
    });

    expect(replies.map((reply) => reply.text)).toEqual([
      "Airing today (Thai time):\n23:00 Salt and Starlight, episode 7 (delayed: Delayed one week)",
    ]);
  });
});

describe("the bot's answer to `week`", () => {
  it("is the next seven schedule days grouped by day, days with nothing left out", async () => {
    await linked("ada", [TODAY_SHOW, LATE_SHOW, DELAYED_SHOW, LAST_DAY_SHOW]);
    await linked("bob", [OTHER_SHOW]);

    expect(await ask("U-ada", "week")).toEqual([
      [
        "Your next seven days (Thai time):",
        "",
        "Saturday 3 Oct",
        "22:30 Lantern Street Diaries, episode 5",
        "00:30 Clockwork Orchard, episode 3",
        "",
        "Sunday 4 Oct",
        "23:00 Salt and Starlight, episode 7 (delayed: Delayed one week)",
        "",
        "Friday 9 Oct",
        "05:00 Moss and Thunder, episode 1",
      ].join("\n"),
    ]);
  });

  it("says so when nothing the sender follows airs in the seven days", async () => {
    await linked("ada", []);

    expect(await ask("U-ada", "week")).toEqual(["Nothing you follow airs in the next seven days."]);
  });
});

describe("what the bot understands", () => {
  it.each(["today", "TODAY", "Today", "  today  ", "\ttoday\n"])(
    "reads %j as today",
    async (text) => {
      await linked("ada", [TODAY_SHOW]);

      expect(await ask("U-ada", text)).toEqual([
        "Airing today (Thai time):\n22:30 Lantern Street Diaries, episode 5",
      ]);
    },
  );

  it.each(["week", "WEEK", " Week "])("reads %j as week", async (text) => {
    await linked("ada", [TODAY_SHOW]);

    const [reply] = await ask("U-ada", text);

    expect(reply).toMatch(/^Your next seven days/);
  });

  it.each(["hello", "today please", "to day", "weekly", "", "วันนี้"])(
    "answers %j with the usage message, linked or not",
    async (text) => {
      await linked("ada", [TODAY_SHOW]);

      expect(await ask("U-ada", text)).toEqual([USAGE_REPLY]);
      expect(await ask("U-stranger", text)).toEqual([USAGE_REPLY]);
    },
  );

  it("keeps the usage message short and names both commands", () => {
    expect(USAGE_REPLY).toContain("today");
    expect(USAGE_REPLY).toContain("week");
    expect(USAGE_REPLY.length).toBeLessThan(120);
  });
});

describe("a sender with no linked account", () => {
  it.each(["today", "week"])("is given the link to connect when asking for %s", async (text) => {
    await linked("ada", [TODAY_SHOW]);

    const [reply, ...rest] = await ask("U-stranger", text);

    expect(rest).toEqual([]);
    expect(reply).toContain(SETTINGS);
    expect(reply).not.toContain("Lantern Street Diaries");
  });
});

describe("what the bot ignores", () => {
  it("does not answer a message that is not text", async () => {
    await linked("ada", [TODAY_SHOW]);
    const { messenger, replies } = recordingMessenger();
    const sticker = { ...textFrom("U-ada", "today"), message: { type: "sticker", id: "2" } };
    const image = { ...textFrom("U-ada", "today"), message: { type: "image", id: "3" } };

    const response = await deliver([sticker, image], messenger);

    expect(response.status).toBe(200);
    expect(replies).toEqual([]);
  });

  it("does not answer an event without a reply token or without a sender", async () => {
    await linked("ada", [TODAY_SHOW]);
    const { messenger, replies } = recordingMessenger();
    const noToken = { ...textFrom("U-ada", "today"), replyToken: undefined };
    const emptyToken = { ...textFrom("U-ada", "today"), replyToken: "" };
    const fromGroup = {
      ...textFrom("U-ada", "today"),
      source: { type: "group", groupId: "C-1", userId: "U-ada" },
    };
    const noSource = { ...textFrom("U-ada", "today"), source: undefined };

    const response = await deliver([noToken, emptyToken, fromGroup, noSource], messenger);

    expect(response.status).toBe(200);
    expect(replies).toEqual([]);
  });

  it("does not answer a delivery whose signature is wrong", async () => {
    await linked("ada", [TODAY_SHOW]);
    const { messenger, replies } = recordingMessenger();

    const response = await deliver(
      [textFrom("U-ada", "today")],
      messenger,
      "bm90IHRoZSBzaWduYXR1cmU=",
    );

    expect(response.status).toBe(401);
    expect(replies).toEqual([]);
  });
});

describe("replies and the push quota", () => {
  it("uses the reply endpoint, never a push, and leaves the monthly counter alone", async () => {
    await linked("ada", [TODAY_SHOW, LATE_SHOW]);
    const { messenger, replies, pushed } = recordingMessenger();

    await deliver(
      [
        textFrom("U-ada", "today"),
        textFrom("U-ada", "week"),
        textFrom("U-ada", "hello"),
        textFrom("U-stranger", "today"),
      ],
      messenger,
    );

    expect(replies).toHaveLength(4);
    expect(pushed).toEqual([]);
    expect(await PushQuota.countDocuments()).toBe(0);
    expect((await pushesThisMonth(NOW)).count).toBe(0);
    expect((await pushesThisMonth()).count).toBe(0);
  });
});

describe("a reply that fails", () => {
  it("still answers 200 to LINE, answers the other messages, and logs only the safe error", async () => {
    await linked("ada", [TODAY_SHOW]);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    let calls = 0;
    const { messenger, replies } = recordingMessenger(() =>
      ++calls === 1
        ? { ok: false, error: "LINE reply failed (400): Invalid reply token" }
        : { ok: true },
    );
    const first = textFrom("U-ada", "today");

    const response = await deliver([first, textFrom("U-ada", "week")], messenger);

    expect(response.status).toBe(200);
    expect(replies).toHaveLength(2);
    expect(errors).toHaveBeenCalledExactlyOnceWith(
      "[line] reply failed: LINE reply failed (400): Invalid reply token",
    );
    expect(JSON.stringify(errors.mock.calls)).not.toContain(first.replyToken);
  });

  it("still answers 200 when the sender throws", async () => {
    await linked("ada", [TODAY_SHOW]);
    const errors = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const { messenger } = recordingMessenger(() => {
      throw new Error("boom");
    });

    const response = await deliver([textFrom("U-ada", "today")], messenger);

    expect(response.status).toBe(200);
    expect(errors).toHaveBeenCalled();
  });
});

describe("a very long answer", () => {
  it("is cut at a line end to fit one LINE text message", async () => {
    const userId = await linked("ada", []);
    const title = "A Rather Long Title For A Show ".repeat(3).trim();
    const routes = Array.from({ length: 80 }, (_, index) => `long-show-${index}`);
    await Show.insertMany(
      routes.map((route) => ({
        route,
        title,
        status: "ongoing",
        totalEpisodes: 12,
        lastSeenAt: NOW,
      })),
    );
    await Episode.insertMany(
      routes.map((showRoute, index) => ({
        showRoute,
        episodeNumber: 1,
        firstEpisodeNumber: null,
        airAt: new Date(NOW.getTime() + index * 60_000),
        delayed: false,
        delayedText: null,
        syncedAt: NOW,
      })),
    );
    for (const route of routes) await followShow(userId, route);

    const [reply] = await ask("U-ada", "today");

    expect(reply?.length).toBeLessThanOrEqual(LINE_TEXT_LIMIT);
    expect(reply?.split("\n").at(-1)).toMatch(/more/);
    expect(reply?.split("\n").at(-2)).toMatch(/, episode 1$/);
  });
});

describe("the webhook route", () => {
  it("answers a message with the handlers and the sender the environment selects", async () => {
    process.env.LINE_MESSAGING_CHANNEL_SECRET = CHANNEL_SECRET;
    process.env.USE_FAKES = "true";
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    await linked("ada", []);
    const message = textFrom("U-ada", "hello");
    const follow = { type: "unfollow", timestamp: NOW.getTime(), source: message.source };

    const response = await POST(signedRequest([message, follow]));

    expect(response.status).toBe(200);
    expect(repliesInLineLog(log.mock.calls.map(([line]) => String(line)).join("\n"))).toEqual([
      { replyToken: message.replyToken, text: USAGE_REPLY },
    ]);
    // The friendship handlers are still in place beside the new one.
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false });
  });
});
