import { createHmac, timingSafeEqual } from "node:crypto";

import { lineWebhookEnv } from "@/lib/env";

import { lineEventSchema, lineWebhookBodySchema, type LineEvent } from "./schema";
import { setFriendByLineUserId } from "./service";

export type LineEventHandler = (event: LineEvent) => Promise<void>;
export type LineEventHandlers = Partial<Record<string, LineEventHandler>>;

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
    await setFriendByLineUserId(lineUserId, friend, new Date(event.timestamp ?? Date.now()));
  };
}

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
  channelSecret?: string | undefined;
  handlers?: LineEventHandlers;
};

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
