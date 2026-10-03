import { fakesEnabled, lineMessagingEnv } from "@/lib/env";

import { createFakeMessenger } from "./fake-messenger";

export type SendResult = { ok: true } | { ok: false; error: string };

export interface LineMessenger {
  readonly name: "messaging-api" | "fake";
  push(lineUserId: string, text: string, retryKey: string): Promise<SendResult>;
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
  kind: string;
  url: string;
  headers?: Record<string, string>;
  body: Record<string, unknown>;
  alsoSent?: readonly number[];
};

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

export function lineMessenger(): LineMessenger {
  if (fakesEnabled()) return createFakeMessenger();
  const env = lineMessagingEnv();
  return env ? createMessagingApiMessenger(env) : notConfigured;
}
