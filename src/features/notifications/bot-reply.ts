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
import { dayWindowOf, groupByDay, weekRange } from "@/features/schedule/day-window";
import { appUrl } from "@/lib/env";

import { notLinkedReply, todayReply, USAGE_REPLY, weekReply } from "./reply-text";

type Command = "today" | "week";

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
  messenger?: LineMessenger;
  now?: () => Date;
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
  const { start, end, windows } = weekRange(now);
  const entries = await followedEpisodesBetween(userId, start, end);
  return weekReply(groupByDay(entries, (entry) => new Date(entry.airAt), windows));
}

function messageHandler(deps: BotReplyDeps = {}): LineEventHandler {
  return async (event) => {
    const parsed = textMessageSchema.safeParse(event);
    if (!parsed.success) return;
    const { replyToken, source, message } = parsed.data;

    const command = commandOf(message.text);
    const text = command ? await answerTo(command, source.userId, deps) : USAGE_REPLY;

    const result = await (deps.messenger ?? lineMessenger()).reply(replyToken, text);
    if (!result.ok) console.error(`[line] reply failed: ${result.error}`);
  };
}

export function botEventHandlers(deps: BotReplyDeps = {}): LineEventHandlers {
  return { ...lineEventHandlers, message: messageHandler(deps) };
}
