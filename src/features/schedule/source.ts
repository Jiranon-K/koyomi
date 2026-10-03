export const SHOW_STATUSES = ["ongoing", "finished", "delayed", "upcoming", "unknown"] as const;
export type ShowStatus = (typeof SHOW_STATUSES)[number];

export type SourceShow = {
  route: string;
  title: string;
  status: ShowStatus;
  totalEpisodes: number;
  coverUrl: string | null;
};

export type SourceEpisode = {
  show: SourceShow;
  episodeNumber: number;
  firstEpisodeNumber: number | null;
  airAt: Date;
  delayed: boolean;
  delayedText: string | null;
};

export type SourceTimetable = {
  episodes: SourceEpisode[];
  requests: number;
  skipped: number;
};

export type ScheduleSourceName = "animeschedule" | "fake";

export interface ScheduleSource {
  readonly name: ScheduleSourceName;
  fetchTimetable(now: Date): Promise<SourceTimetable>;
}

export type ScheduleSourceFailure =
  "rate-limited" | "unauthorized" | "http" | "network" | "invalid";

export class ScheduleSourceError extends Error {
  constructor(
    readonly kind: ScheduleSourceFailure,
    message: string,
  ) {
    super(message);
    this.name = "ScheduleSourceError";
  }
}
