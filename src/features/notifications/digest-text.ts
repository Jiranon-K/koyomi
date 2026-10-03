import { formatAirTime } from "@/features/schedule/day-window";
import type { ScheduleEntry } from "@/features/schedule/service";

// The wording of what the bot says about episodes. This file is the only owner of the format: the
// daily digest uses it, and so do the bot's `today` and `week` replies.

function episodeLabel(entry: ScheduleEntry): string {
  return entry.firstEpisodeNumber === null
    ? `episode ${entry.episodeNumber}`
    : `episodes ${entry.firstEpisodeNumber}-${entry.episodeNumber}`;
}

function delayedMark(entry: ScheduleEntry): string {
  if (!entry.delayed) return "";
  const reason = entry.delayedText?.trim();
  return reason && reason.toLowerCase() !== "delayed" ? ` (delayed: ${reason})` : " (delayed)";
}

/** One episode on one line: Thai air time, title, episode number, and a mark when it is delayed. */
export function episodeLine(entry: ScheduleEntry): string {
  const time = formatAirTime(new Date(entry.airAt));
  return `${time} ${entry.title}, ${episodeLabel(entry)}${delayedMark(entry)}`;
}

/** The daily digest: the day's followed episodes in the order given, then the dashboard link. */
export function digestText(entries: readonly ScheduleEntry[], dashboardUrl: string): string {
  return [
    "Airing today (Thai time):",
    ...entries.map(episodeLine),
    "",
    `Your week: ${dashboardUrl}`,
  ].join("\n");
}
