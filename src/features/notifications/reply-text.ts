import { formatDayDate, formatWeekday } from "@/features/schedule/day-window";
import type { ScheduleDay, ScheduleEntry } from "@/features/schedule/service";

import { AIRING_TODAY_HEADING, episodeLine, fitted } from "./digest-text";

export const USAGE_REPLY = 'Send "today" for what airs today, or "week" for your next seven days.';
const NOTHING_TODAY_REPLY = "Nothing you follow airs today.";
const NOTHING_THIS_WEEK_REPLY = "Nothing you follow airs in the next seven days.";

export function notLinkedReply(settingsUrl: string): string {
  return `This LINE account is not connected to Koyomi yet. Connect it here: ${settingsUrl}`;
}

export function todayReply(entries: readonly ScheduleEntry[]): string {
  if (entries.length === 0) return NOTHING_TODAY_REPLY;
  return fitted([AIRING_TODAY_HEADING, ...entries.map(episodeLine)]);
}

export function weekReply(days: readonly ScheduleDay[]): string {
  const airing = days.filter((day) => day.entries.length > 0);
  if (airing.length === 0) return NOTHING_THIS_WEEK_REPLY;
  return fitted([
    "Your next seven days (Thai time):",
    ...airing.flatMap(({ day, entries }) => [
      "",
      `${formatWeekday(day)} ${formatDayDate(day)}`,
      ...entries.map(episodeLine),
    ]),
  ]);
}
