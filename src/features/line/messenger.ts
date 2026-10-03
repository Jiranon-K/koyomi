import { fakesEnabled, lineMessagingEnv } from "@/lib/env";

import { createFakeMessenger } from "./fake-messenger";

// The one way this app sends LINE messages. Pushes cost quota, so nothing calls `push` directly:
// it goes through the quota guard in `src/features/notifications/quota.ts`. Replies are free and
// are sent with `reply`.

export type SendResult =
  | { ok: true }
  /** `error` is safe to store and show: a status and the message LINE gave, never a token. */
  | { ok: false; error: string };

export interface LineMessenger {
  readonly name: "messaging-api" | "fake";
  /**
   * Sends one text message to a LINE user. `retryKey` is a UUID: LINE accepts a push with the same
   * key only once (for 24 hours), so repeating a push whose answer was lost cannot send twice.
   * Never throws.
   */
  push(lineUserId: string, text: string, retryKey: string): Promise<SendResult>;
  /**
   * Answers a message with one text message, through the reply token of its webhook event. A reply
   * is free: it is not a push, is never counted against the quota and so does not go through the
   * quota guard. A reply token works once and only for a short time, so a failed reply is not
   * retried. Never throws.
   */
  reply(replyToken: string, text: string): Promise<SendResult>;
}

const PUSH_URL = "https://api.line.me/v2/bot/message/push";
const REPLY_URL = "https://api.line.me/v2/bot/message/reply";
const TIMEOUT_MS = 10_000;

type MessagingApiOptions = {
  channelAccessToken: string;
  fetch?: typeof fetch;
};

async function lineMessage(response: Response): Promise<string> {
  const body: unknown = await response.json().catch(() => null);
  const message =
    typeof body === "object" && body !== null && "message" in body ? body.message : undefined;
  return typeof message === "string" ? `: ${message}` : "";
}

type Call = {
  /** Names the call in an error: "push" or "reply". */
  kind: string;
  url: string;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
  /** Statuses besides 2xx that mean the message was sent. */
  alsoSent?: readonly number[];
};

/** The real sender: the LINE Messaging API over `fetch`, no SDK. */
export function createMessagingApiMessenger(options: MessagingApiOptions): LineMessenger {
  const send = options.fetch ?? fetch;

  async function call({ kind, url, headers, body, alsoSent = [] }: Call): Promise<SendResult> {
    try {
      const response = await send(url, {
        method: "POST",
        headers: {
          authorization: `Bearer ${options.channelAccessToken}`,
          "content-type": "application/json",
          ...headers,
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
      if (response.ok || alsoSent.includes(response.status)) return { ok: true };
      return {
        ok: false,
        error: `LINE ${kind} failed (${response.status})${await lineMessage(response)}`,
      };
    } catch (error) {
      // Only the kind of failure: an error message could repeat the request.
      const reason = error instanceof Error ? error.name : "unknown error";
      return { ok: false, error: `LINE ${kind} did not complete (${reason})` };
    }
  }

  return {
    name: "messaging-api",
    push(lineUserId, text, retryKey) {
      return call({
        kind: "push",
        url: PUSH_URL,
        headers: { "x-line-retry-key": retryKey },
        body: { to: lineUserId, messages: [{ type: "text", text }] },
        // 409: LINE already accepted a push with this retry key, so the message was sent.
        alsoSent: [409],
      });
    },
    reply(replyToken, text) {
      return call({
        kind: "reply",
        url: REPLY_URL,
        body: { replyToken, messages: [{ type: "text", text }] },
      });
    },
  };
}

const NOT_CONFIGURED: SendResult = {
  ok: false,
  error: "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not set.",
};

const notConfigured: LineMessenger = {
  name: "messaging-api",
  async push() {
    return NOT_CONFIGURED;
  },
  async reply() {
    return NOT_CONFIGURED;
  },
};

/** The sender the environment selects: the fake when `USE_FAKES` is true, else the Messaging API. */
export function lineMessenger(): LineMessenger {
  if (fakesEnabled()) return createFakeMessenger();
  const env = lineMessagingEnv();
  return env ? createMessagingApiMessenger(env) : notConfigured;
}
