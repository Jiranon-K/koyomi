import { createHmac, timingSafeEqual } from "node:crypto";

import { lineWebhookEnv } from "@/lib/env";

import { lineEventSchema, lineWebhookBodySchema, type LineEvent } from "./schema";
import { setFriendByLineUserId } from "./service";

export type LineEventHandler = (event: LineEvent) => Promise<void>;
export type LineEventHandlers = Partial<Record<string, LineEventHandler>>;

/**
 * True when `signature` is the Base64 HMAC-SHA256 of the raw request body under the Messaging API
 * channel secret. The comparison takes the same time whatever the signature is.
 */
export function isValidSignature(
  rawBody: string,
  signature: string | null,
  channelSecret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac("sha256", channelSecret).update(rawBody).digest();
  const received = Buffer.from(signature, "base64");
  return received.length === expected.length && timingSafeEqual(received, expected);
}

function friendshipHandler(friend: boolean): LineEventHandler {
  return async (event) => {
    const lineUserId = event.source?.type === "user" ? event.source.userId : undefined;
    if (!lineUserId) return;
    // An event for a LINE user nobody has linked changes nothing; that is not an error.
    await setFriendByLineUserId(lineUserId, friend, new Date(event.timestamp ?? Date.now()));
  };
}

/**
 * What the webhook does for each LINE event type; a type that is not listed is ignored.
 * To handle another type (ticket 06: `message`, answered through `event.replyToken`), add its
 * handler here. A handler gets the whole event as LINE sent it and must not throw for a sender it
 * does not know.
 */
export const lineEventHandlers: LineEventHandlers = {
  follow: friendshipHandler(true),
  unfollow: friendshipHandler(false),
};

function parseEvents(rawBody: string): LineEvent[] {
  let json: unknown;
  try {
    json = JSON.parse(rawBody);
  } catch {
    return [];
  }
  const body = lineWebhookBodySchema.safeParse(json);
  if (!body.success) return [];
  return body.data.events.flatMap((candidate) => {
    const event = lineEventSchema.safeParse(candidate);
    return event.success ? [event.data] : [];
  });
}

type WebhookOptions = {
  /** Defaults to the configured Messaging API channel secret. */
  channelSecret?: string | undefined;
  handlers?: LineEventHandlers;
};

/**
 * The whole webhook: refuse when no channel secret is configured, refuse a bad or missing
 * signature, and only then read the body. A correctly signed request is always answered with 200,
 * whatever its events are and even when handling one fails, so that LINE does not keep resending.
 */
export async function handleLineWebhook(
  request: Request,
  options: WebhookOptions = {},
): Promise<Response> {
  const channelSecret =
    "channelSecret" in options ? options.channelSecret : lineWebhookEnv()?.channelSecret;
  const handlers = options.handlers ?? lineEventHandlers;

  if (!channelSecret) return new Response("LINE webhook is not configured", { status: 503 });

  const rawBody = await request.text();
  if (!isValidSignature(rawBody, request.headers.get("x-line-signature"), channelSecret)) {
    return new Response("Invalid signature", { status: 401 });
  }

  for (const event of parseEvents(rawBody)) {
    const handler = Object.hasOwn(handlers, event.type) ? handlers[event.type] : undefined;
    if (!handler) continue;
    try {
      await handler(event);
    } catch (error) {
      console.error(`[line] failed to handle a ${event.type} event`, error);
    }
  }
  return new Response(null, { status: 200 });
}
