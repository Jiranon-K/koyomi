import type { ScheduleEntry } from "./service";

export function episodeLabel(entry: ScheduleEntry): string {
  return entry.firstEpisodeNumber === null
    ? `Episode ${entry.episodeNumber}`
    : `Episodes ${entry.firstEpisodeNumber}–${entry.episodeNumber}`;
}

export function delayNote(entry: ScheduleEntry): string | null {
  const reason = entry.delayedText?.trim();
  return reason && reason.toLowerCase() !== "delayed" ? reason : null;
}

export function entryKey(entry: ScheduleEntry): string {
  return `${entry.showRoute}#${entry.episodeNumber}`;
}
