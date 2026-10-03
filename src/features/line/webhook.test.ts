import { createHmac } from "node:crypto";

import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { LineLink } from "./model";
import { getLineStatus, recordLineAccount } from "./service";
import { handleLineWebhook, isValidSignature, type LineEventHandlers } from "./webhook";

const CHANNEL_SECRET = "test-messaging-channel-secret";
const ENDPOINT = "http://localhost:3000/api/line/webhook";

let server: MongoMemoryServer;

function sign(body: string, secret = CHANNEL_SECRET): string {
  return createHmac("sha256", secret).update(body).digest("base64");
}

function event(type: string, lineUserId: string, timestamp = 1_790_000_000_000) {
  return { type, timestamp, source: { type: "user", userId: lineUserId } };
}

function webhookRequest(body: string, signature: string | null) {
  return new Request(ENDPOINT, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature === null ? {} : { "x-line-signature": signature }),
    },
    body,
  });
}

function deliver(events: unknown[], options: Parameters<typeof handleLineWebhook>[1] = {}) {
  const body = JSON.stringify({ destination: "U-bot", events });
  return handleLineWebhook(webhookRequest(body, sign(body)), {
    channelSecret: CHANNEL_SECRET,
    ...options,
  });
}

async function linkAda(friend: boolean) {
  await recordLineAccount(
    { userId: "user-ada", lineUserId: "U-ada", accessToken: "token" },
    async () => friend,
  );
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("line-webhook-test");
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await getLineStatus("nobody");
  await LineLink.deleteMany({});
});

describe("isValidSignature", () => {
  const body = '{"events":[]}';

  it("accepts the Base64 HMAC-SHA256 of the raw body under the channel secret", () => {
    expect(isValidSignature(body, sign(body), CHANNEL_SECRET)).toBe(true);
  });

  it.each([
    ["a signature made with another secret", sign(body, "another-secret")],
    ["a signature of a different body", sign('{"events":[{}]}')],
    ["a truncated signature", sign(body).slice(0, 20)],
    ["a signature that is not Base64", "not base64 at all!"],
    ["an empty signature", ""],
    ["a missing signature", null],
  ])("rejects %s", (_case, signature) => {
    expect(isValidSignature(body, signature, CHANNEL_SECRET)).toBe(false);
  });
});

describe("the LINE webhook", () => {
  it("rejects a request with no signature and changes nothing", async () => {
    await linkAda(false);
    const body = JSON.stringify({ events: [event("follow", "U-ada")] });

    const response = await handleLineWebhook(webhookRequest(body, null), {
      channelSecret: CHANNEL_SECRET,
    });

    expect(response.status).toBe(401);
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false });
  });

  it("rejects a request with a bad signature and changes nothing", async () => {
    await linkAda(false);
    const body = JSON.stringify({ events: [event("follow", "U-ada")] });

    const response = await handleLineWebhook(webhookRequest(body, sign(body, "wrong-secret")), {
      channelSecret: CHANNEL_SECRET,
    });

    expect(response.status).toBe(401);
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false });
  });

  it("checks the signature before it reads the body as JSON", async () => {
    const handlers: LineEventHandlers = { follow: vi.fn(async () => {}) };
    const body = "{ this is not JSON";

    const unsigned = await handleLineWebhook(webhookRequest(body, "bad"), {
      channelSecret: CHANNEL_SECRET,
      handlers,
    });
    const signed = await handleLineWebhook(webhookRequest(body, sign(body)), {
      channelSecret: CHANNEL_SECRET,
      handlers,
    });

    expect(unsigned.status).toBe(401);
    expect(signed.status).toBe(200);
    expect(handlers.follow).not.toHaveBeenCalled();
  });

  it("rejects every request when the channel secret is not configured", async () => {
    await linkAda(false);
    const body = JSON.stringify({ events: [event("follow", "U-ada")] });

    const responses = await Promise.all([
      handleLineWebhook(webhookRequest(body, sign(body)), { channelSecret: undefined }),
      handleLineWebhook(webhookRequest(body, sign(body, "")), { channelSecret: "" }),
      handleLineWebhook(webhookRequest(body, null), { channelSecret: undefined }),
    ]);

    expect(responses.map((response) => response.status)).toEqual([503, 503, 503]);
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false });
  });

  it("sets the friend flag on follow", async () => {
    await linkAda(false);

    const response = await deliver([event("follow", "U-ada")]);

    expect(response.status).toBe(200);
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: true, remindersOn: true });
  });

  it("clears the friend flag on unfollow", async () => {
    await linkAda(true);

    const response = await deliver([event("unfollow", "U-ada")]);

    expect(response.status).toBe(200);
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false, remindersOn: false });
  });

  it("applies the events of one delivery in the order they happened", async () => {
    await linkAda(false);

    await deliver([event("unfollow", "U-ada", 2000), event("follow", "U-ada", 1000)]);

    expect(await getLineStatus("user-ada")).toMatchObject({ friend: false });
  });

  it("answers 200 and stores nothing for a LINE user nobody has linked", async () => {
    const response = await deliver([event("follow", "U-stranger"), event("unfollow", "U-other")]);

    expect(response.status).toBe(200);
    expect(await LineLink.countDocuments()).toBe(0);
  });

  it("answers 200 to event types it does not handle", async () => {
    await linkAda(true);

    const response = await deliver([
      { ...event("message", "U-ada"), replyToken: "token", message: { type: "text", text: "hi" } },
      event("postback", "U-ada"),
      { type: "follow", timestamp: 1, source: { type: "group", groupId: "C-1" } },
      { type: "unfollow" },
      "not even an object",
    ]);

    expect(response.status).toBe(200);
    expect(await getLineStatus("user-ada")).toMatchObject({ friend: true });
  });

  it("answers 200 to the empty delivery LINE sends to verify the endpoint", async () => {
    const response = await deliver([]);

    expect(response.status).toBe(200);
  });

  it("answers 200 and carries on when a handler fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const seen: string[] = [];
    const handlers: LineEventHandlers = {
      follow: async () => {
        throw new Error("database down");
      },
      unfollow: async (received) => {
        seen.push(received.type);
      },
    };

    const response = await deliver([event("follow", "U-ada"), event("unfollow", "U-ada")], {
      handlers,
    });

    expect(response.status).toBe(200);
    expect(seen).toEqual(["unfollow"]);
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });

  it("hands an event to the handler registered for its type, with its own fields", async () => {
    const message = vi.fn(async () => {});
    const sent = {
      ...event("message", "U-ada"),
      replyToken: "reply-token",
      message: { type: "text", text: "today" },
    };

    await deliver([sent], { handlers: { message } });

    expect(message).toHaveBeenCalledWith(sent);
  });
});
