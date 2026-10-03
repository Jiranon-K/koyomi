import { afterEach, describe, expect, it, vi } from "vitest";

import { createFakeMessenger, lineLog, pushesInLineLog } from "./fake-messenger";
import { createMessagingApiMessenger, lineMessenger } from "./messenger";

const TOKEN = "test-channel-access-token";
const RETRY_KEY = "123e4567-e89b-42d3-a456-426614174000";
const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

function answering(response: () => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  const fake: typeof fetch = async (input, init) => {
    calls.push({ url: String(input), init: init ?? {} });
    return response();
  };
  return { fetch: fake, calls };
}

describe("the Messaging API messenger", () => {
  it("posts one text message to the push endpoint with the token and the retry key", async () => {
    const { fetch, calls } = answering(() => Response.json({}));
    const messenger = createMessagingApiMessenger({ channelAccessToken: TOKEN, fetch });

    const result = await messenger.push("U-ada", "first line\nsecond line", RETRY_KEY);

    expect(result).toEqual({ ok: true });
    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe("https://api.line.me/v2/bot/message/push");
    expect(calls[0]?.init.method).toBe("POST");
    expect(Object.fromEntries(new Headers(calls[0]?.init.headers))).toEqual({
      authorization: `Bearer ${TOKEN}`,
      "content-type": "application/json",
      "x-line-retry-key": RETRY_KEY,
    });
    expect(JSON.parse(String(calls[0]?.init.body))).toEqual({
      to: "U-ada",
      messages: [{ type: "text", text: "first line\nsecond line" }],
    });
  });

  it("treats 409 as sent: LINE already accepted a push with this retry key", async () => {
    const { fetch } = answering(() =>
      Response.json({ message: "The retry key is already accepted" }, { status: 409 }),
    );
    const messenger = createMessagingApiMessenger({ channelAccessToken: TOKEN, fetch });

    expect(await messenger.push("U-ada", "text", RETRY_KEY)).toEqual({ ok: true });
  });

  it.each([400, 401, 429, 500])("reports a %i answer as a failure", async (status) => {
    const { fetch } = answering(() => Response.json({ message: "LINE says no" }, { status }));
    const messenger = createMessagingApiMessenger({ channelAccessToken: TOKEN, fetch });

    expect(await messenger.push("U-ada", "text", RETRY_KEY)).toEqual({
      ok: false,
      error: `LINE push failed (${status}): LINE says no`,
    });
  });

  it("reports a network failure instead of throwing, without the token in the error", async () => {
    const { fetch } = answering(() => {
      throw new TypeError(`fetch failed for Bearer ${TOKEN}`);
    });
    const messenger = createMessagingApiMessenger({ channelAccessToken: TOKEN, fetch });

    const result = await messenger.push("U-ada", "text", RETRY_KEY);

    expect(result).toEqual({ ok: false, error: "LINE push did not complete (TypeError)" });
    expect(JSON.stringify(result)).not.toContain(TOKEN);
  });
});

describe("lineMessenger", () => {
  it("is the fake when USE_FAKES is true", () => {
    process.env.USE_FAKES = "true";
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = TOKEN;

    expect(lineMessenger().name).toBe("fake");
  });

  it("is the Messaging API otherwise", () => {
    delete process.env.USE_FAKES;
    process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN = TOKEN;

    expect(lineMessenger().name).toBe("messaging-api");
  });

  it("fails every push by variable name while no access token is configured", async () => {
    delete process.env.USE_FAKES;
    delete process.env.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
    const network = vi.spyOn(globalThis, "fetch");

    expect(await lineMessenger().push("U-ada", "text", RETRY_KEY)).toEqual({
      ok: false,
      error: "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not set.",
    });
    expect(network).not.toHaveBeenCalled();
  });
});

describe("the fake messenger and its log", () => {
  const push = { to: "U-ada", retryKey: RETRY_KEY, text: 'Airing today\n22:30 "Quoted" title' };

  it("writes each push to the server log as one line that the reader gets back", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);

    expect(await createFakeMessenger().push(push.to, push.text, push.retryKey)).toEqual({
      ok: true,
    });

    expect(log).toHaveBeenCalledExactlyOnceWith(lineLog(push));
    expect(lineLog(push)).not.toContain("\n");
    expect(pushesInLineLog(lineLog(push), "U-ada")).toEqual([push]);
  });

  it("returns only the pushes to the asked user, oldest first", () => {
    const later = { ...push, text: "later" };
    const log = [lineLog(push), lineLog({ ...push, to: "U-bob" }), lineLog(later)].join("\n");

    expect(pushesInLineLog(log, "U-ada")).toEqual([push, later]);
    expect(pushesInLineLog(log, "U-nobody")).toEqual([]);
  });

  it("tolerates unrelated server output, Windows line endings and a half-written line", () => {
    const whole = lineLog(push);
    const log = ["▲ Next.js", whole, " POST /api/dev/digest 200", whole.slice(0, 30), ""].join(
      "\r\n",
    );

    expect(pushesInLineLog(log, "U-ada")).toEqual([push]);
  });
});
