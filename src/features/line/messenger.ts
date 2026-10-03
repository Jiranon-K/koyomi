import { fakesEnabled, lineMessagingEnv } from "@/lib/env";

import { createFakeMessenger } from "./fake-messenger";

// The one way this app sends LINE messages. Pushes cost quota, so nothing calls `push` directly:
// it goes through the quota guard in `src/features/notifications/quota.ts`.

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
  // Ticket 06 adds `reply(replyToken, text)` here; replies are free and are never counted.
}

const PUSH_URL = "https://api.line.me/v2/bot/message/push";
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

/** The real sender: the LINE Messaging API over `fetch`, no SDK. */
export function createMessagingApiMessenger(options: MessagingApiOptions): LineMessenger {
  const send = options.fetch ?? fetch;
  return {
    name: "messaging-api",
    async push(lineUserId, text, retryKey) {
      try {
        const response = await send(PUSH_URL, {
          method: "POST",
          headers: {
            authorization: `Bearer ${options.channelAccessToken}`,
            "content-type": "application/json",
            "x-line-retry-key": retryKey,
          },
          body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
          signal: AbortSignal.timeout(TIMEOUT_MS),
        });
        // 409: LINE already accepted a push with this retry key, so the message was sent.
        if (response.ok || response.status === 409) return { ok: true };
        return {
          ok: false,
          error: `LINE push failed (${response.status})${await lineMessage(response)}`,
        };
      } catch (error) {
        // Only the kind of failure: an error message could repeat the request.
        const reason = error instanceof Error ? error.name : "unknown error";
        return { ok: false, error: `LINE push did not complete (${reason})` };
      }
    },
  };
}

const notConfigured: LineMessenger = {
  name: "messaging-api",
  async push() {
    return { ok: false, error: "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN is not set." };
  },
};

/** The sender the environment selects: the fake when `USE_FAKES` is true, else the Messaging API. */
export function lineMessenger(): LineMessenger {
  if (fakesEnabled()) return createFakeMessenger();
  const env = lineMessagingEnv();
  return env ? createMessagingApiMessenger(env) : notConfigured;
}
