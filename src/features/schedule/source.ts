// The seam between Koyomi and whoever knows the broadcast schedule. The real implementation is
// `animeschedule.ts`; `fake-source.ts` serves fixture data to tests and the end-to-end server.

export const SHOW_STATUSES = ["ongoing", "finished", "delayed", "upcoming", "unknown"] as const;
export type ShowStatus = (typeof SHOW_STATUSES)[number];

export type SourceShow = {
  /** The source's stable slug; Koyomi's key for a show. */
  route: string;
  title: string;
  status: ShowStatus;
  /** 0 when the source does not know. */
  totalEpisodes: number;
};

export type SourceEpisode = {
  show: SourceShow;
  episodeNumber: number;
  /** Set only when several episodes air together: the block is `firstEpisodeNumber`–`episodeNumber`. */
  firstEpisodeNumber: number | null;
  /** The Japanese (raw) broadcast instant. */
  airAt: Date;
  delayed: boolean;
  /** The source's own wording for the delay, when it gives one. */
  delayedText: string | null;
};

export type SourceTimetable = {
  episodes: SourceEpisode[];
  /** How many HTTP requests the fetch took. */
  requests: number;
  /** Entries the source returned that could not be read and were left out. */
  skipped: number;
};

export type ScheduleSourceName = "animeschedule" | "fake";

export interface ScheduleSource {
  readonly name: ScheduleSourceName;
  /** The episodes airing around `now`: at least the current week and the one after. */
  fetchTimetable(now: Date): Promise<SourceTimetable>;
}

export type ScheduleSourceFailure =
  "rate-limited" | "unauthorized" | "http" | "network" | "invalid";

/** Any failure to get a timetable. A sync turns it into a failed run record instead of crashing. */
export class ScheduleSourceError extends Error {
  constructor(
    readonly kind: ScheduleSourceFailure,
    message: string,
  ) {
    super(message);
    this.name = "ScheduleSourceError";
  }
}
