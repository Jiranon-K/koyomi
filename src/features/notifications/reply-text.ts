import { formatDayDate, formatWeekday, type DayWindow } from "@/features/schedule/day-window";
import type { ScheduleEntry } from "@/features/schedule/service";

import { AIRING_TODAY_HEADING, episodeLine } from "./digest-text";

// The wording of the bot's answers to a message. An episode is always written by `episodeLine`,
// so a reply and the daily digest read the same.

/** LINE refuses a text message longer than this. */
export const LINE_TEXT_LIMIT = 5000;

export const USAGE_REPLY = 'Send "today" for what airs today, or "week" for your next seven days.';
export const NOTHING_TODAY_REPLY = "Nothing you follow airs today.";
export const NOTHING_THIS_WEEK_REPLY = "Nothing you follow airs in the next seven days.";

const CUT_NOTE = "(more not shown)";

/** For a LINE user no account has linked: where to connect. */
export function notLinkedReply(settingsUrl: string): string {
  return `This LINE account is not connected to Koyomi yet. Connect it here: ${settingsUrl}`;
}

// Whole lines up to the limit, then a note that the list goes on.
function fitted(lines: readonly string[]): string {
  const text = lines.join("\n");
  if (text.length <= LINE_TEXT_LIMIT) return text;
  const kept: string[] = [];
  let length = CUT_NOTE.length;
  for (const line of lines) {
    length += line.length + 1;
    if (length > LINE_TEXT_LIMIT) break;
    kept.push(line);
  }
  while (kept.at(-1) === "") kept.pop();
  return [...kept, CUT_NOTE].join("\n");
}

/** The answer to `today`: the day's followed episodes in the order given. */
export function todayReply(entries: readonly ScheduleEntry[]): string {
  if (entries.length === 0) return NOTHING_TODAY_REPLY;
  return fitted([AIRING_TODAY_HEADING, ...entries.map(episodeLine)]);
}

/** The answer to `week`: one block per day that has an episode, under the day's name and date. */
export function weekReply(
  days: readonly { window: DayWindow; items: readonly ScheduleEntry[] }[],
): string {
  const airing = days.filter((day) => day.items.length > 0);
  if (airing.length === 0) return NOTHING_THIS_WEEK_REPLY;
  return fitted([
    "Your next seven days (Thai time):",
    ...airing.flatMap(({ window, items }) => [
      "",
      `${formatWeekday(window.day)} ${formatDayDate(window.day)}`,
      ...items.map(episodeLine),
    ]),
  ]);
}
