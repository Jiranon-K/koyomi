import { formatAirTime } from "@/features/schedule/day-window";
import { delayNote } from "@/features/schedule/episode-label";
import type { ScheduleEntry } from "@/features/schedule/service";

export const AIRING_TODAY_HEADING = "Airing today (Thai time):";

export const LINE_TEXT_LIMIT = 5000;

const CUT_NOTE = "(more not shown)";

export function fitted(lines: readonly string[], footer: readonly string[] = []): string {
  const text = [...lines, ...footer].join("\n");
  if (text.length <= LINE_TEXT_LIMIT) return text;
  const tail = [CUT_NOTE, ...footer];
  const kept: string[] = [];
  let length = tail.join("\n").length;
  for (const line of lines) {
    length += line.length + 1;
    if (length > LINE_TEXT_LIMIT) break;
    kept.push(line);
  }
  while (kept.at(-1) === "") kept.pop();
  return [...kept, ...tail].join("\n");
}

function episodeLabel(entry: ScheduleEntry): string {
  return entry.firstEpisodeNumber === null
    ? `episode ${entry.episodeNumber}`
    : `episodes ${entry.firstEpisodeNumber}-${entry.episodeNumber}`;
}

function delayedMark(entry: ScheduleEntry): string {
  if (!entry.delayed) return "";
  const reason = delayNote(entry);
  return reason ? ` (delayed: ${reason})` : " (delayed)";
}

export function episodeLine(entry: ScheduleEntry): string {
  const time = formatAirTime(new Date(entry.airAt));
  return `${time} ${entry.title}, ${episodeLabel(entry)}${delayedMark(entry)}`;
}

export function digestText(entries: readonly ScheduleEntry[], dashboardUrl: string): string {
  return fitted(
    [AIRING_TODAY_HEADING, ...entries.map(episodeLine)],
    ["", `Your week: ${dashboardUrl}`],
  );
}
