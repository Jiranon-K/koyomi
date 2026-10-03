import * as z from "zod";

import { SETTINGS_PATH } from "@/features/auth/paths";
import { followedEpisodesBetween } from "@/features/follows/service";
import { lineMessenger, type LineMessenger } from "@/features/line/messenger";
import { findUserIdByLineUserId } from "@/features/line/service";
import {
  lineEventHandlers,
  type LineEventHandler,
  type LineEventHandlers,
} from "@/features/line/webhook";
import { dayWindowOf, groupByDay, weekWindows } from "@/features/schedule/day-window";
import { appUrl } from "@/lib/env";

import { notLinkedReply, todayReply, USAGE_REPLY, weekReply } from "./reply-text";

// What the bot answers when someone writes to it. This lives here, not in `features/line`, because
// an answer is made of follows, the schedule and the digest's wording, which this feature already
// depends on. `features/line` stays the transport (signature, sender, links) and never imports
// this feature; the webhook Route Handler puts the two together with `botEventHandlers()`.
//
// A reply is free: it goes out through `LineMessenger.reply`, never through the push quota guard.

type Command = "today" | "week";

/** A text message one user sent to the bot directly, with the token to answer it through. */
const textMessageSchema = z.looseObject({
  replyToken: z.string().min(1),
  source: z.looseObject({ type: z.literal("user"), userId: z.string().min(1) }),
  message: z.looseObject({ type: z.literal("text"), text: z.string() }),
});

function commandOf(text: string): Command | undefined {
  const word = text.trim().toLowerCase();
  return word === "today" || word === "week" ? word : undefined;
}

export type BotReplyDeps = {
  /** Defaults to the sender the environment selects. */
  messenger?: LineMessenger;
  /** Defaults to the clock. */
  now?: () => Date;
  /** Where an unlinked sender is told to connect. Defaults to this app's settings page. */
  settingsUrl?: string;
};

async function answerTo(command: Command, lineUserId: string, deps: BotReplyDeps): Promise<string> {
  const userId = await findUserIdByLineUserId(lineUserId);
  if (userId === null) return notLinkedReply(deps.settingsUrl ?? `${appUrl()}${SETTINGS_PATH}`);

  const now = deps.now?.() ?? new Date();
  if (command === "today") {
    const { start, end } = dayWindowOf(now);
    return todayReply(await followedEpisodesBetween(userId, start, end));
  }
  const windows = weekWindows(now);
  const first = windows[0];
  const last = windows.at(-1);
  if (!first || !last) return weekReply([]);
  const entries = await followedEpisodesBetween(userId, first.start, last.end);
  return weekReply(groupByDay(entries, (entry) => new Date(entry.airAt), windows));
}

/**
 * The handler for LINE `message` events. `today` and `week` (any case, spaces around ignored) are
 * answered with the sender's followed episodes, anything else with the usage message. A message
 * that is not text, has no reply token, or was not sent by one user to the bot is ignored.
 *
 * A reply that fails is logged and dropped: a reply token works once, so there is nothing to retry,
 * and the webhook must still answer 200 or LINE sends the event again.
 */
export function messageHandler(deps: BotReplyDeps = {}): LineEventHandler {
  return async (event) => {
    const parsed = textMessageSchema.safeParse(event);
    if (!parsed.success) return;
    const { replyToken, source, message } = parsed.data;

    const command = commandOf(message.text);
    const text = command ? await answerTo(command, source.userId, deps) : USAGE_REPLY;

    const result = await (deps.messenger ?? lineMessenger()).reply(replyToken, text);
    // `error` is a status and LINE's own message, never the access token or the reply token.
    if (!result.ok) console.error(`[line] reply failed: ${result.error}`);
  };
}

/** Every event the webhook handles: the friendship events, and messages answered by the bot. */
export function botEventHandlers(deps: BotReplyDeps = {}): LineEventHandlers {
  return { ...lineEventHandlers, message: messageHandler(deps) };
}
