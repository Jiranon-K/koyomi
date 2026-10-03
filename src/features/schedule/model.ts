import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/mongoose";

import { SHOW_STATUSES, type ScheduleSourceName, type ShowStatus } from "./source";

const EPISODE_RETENTION_SECONDS = 30 * 24 * 60 * 60;

export type ShowDoc = {
  route: string;
  title: string;
  status: ShowStatus;
  totalEpisodes: number;
  lastSeenAt: Date;
};

export type EpisodeDoc = {
  showRoute: string;
  episodeNumber: number;
  firstEpisodeNumber: number | null;
  airAt: Date;
  delayed: boolean;
  delayedText: string | null;
  syncedAt: Date;
};

export type SyncOutcome = "success" | "failure";

export type SyncRunDoc = {
  startedAt: Date;
  finishedAt: Date;
  outcome: SyncOutcome;
  source: ScheduleSourceName;
  requests: number;
  shows: number;
  episodes: number;
  skipped: number;
  error: string | null;
};

const showSchema = new Schema<ShowDoc>({
  route: { type: String, required: true, unique: true },
  title: { type: String, required: true },
  status: { type: String, required: true, enum: SHOW_STATUSES },
  totalEpisodes: { type: Number, required: true },
  lastSeenAt: { type: Date, required: true },
});

const episodeSchema = new Schema<EpisodeDoc>({
  showRoute: { type: String, required: true },
  episodeNumber: { type: Number, required: true },
  firstEpisodeNumber: { type: Number, default: null },
  airAt: { type: Date, required: true },
  delayed: { type: Boolean, required: true },
  delayedText: { type: String, default: null },
  syncedAt: { type: Date, required: true },
});
episodeSchema.index({ showRoute: 1, episodeNumber: 1 }, { unique: true });
episodeSchema.index({ airAt: 1 }, { expireAfterSeconds: EPISODE_RETENTION_SECONDS });

const syncRunSchema = new Schema<SyncRunDoc>({
  startedAt: { type: Date, required: true },
  finishedAt: { type: Date, required: true },
  outcome: { type: String, required: true, enum: ["success", "failure"] },
  source: { type: String, required: true },
  requests: { type: Number, required: true },
  shows: { type: Number, required: true },
  episodes: { type: Number, required: true },
  skipped: { type: Number, required: true },
  error: { type: String, default: null },
});
syncRunSchema.index({ startedAt: -1 });

export const Show = defineModel("Show", showSchema);
export const Episode = defineModel("Episode", episodeSchema);
export const SyncRun = defineModel("ScheduleSyncRun", syncRunSchema);
