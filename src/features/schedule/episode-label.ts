import type { ScheduleEntry } from "./service";

export function episodeLabel(entry: ScheduleEntry): string {
  return entry.firstEpisodeNumber === null
    ? `Episode ${entry.episodeNumber}`
    : `Episodes ${entry.firstEpisodeNumber}–${entry.episodeNumber}`;
}

export function delayNote(entry: ScheduleEntry): string | null {
  return entry.delayedText && entry.delayedText !== "Delayed" ? entry.delayedText : null;
}

export function entryKey(entry: ScheduleEntry): string {
  return `${entry.showRoute}#${entry.episodeNumber}`;
}
