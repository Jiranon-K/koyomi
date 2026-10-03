import { reminderPlaces, type ReminderPlaces } from "@/features/line/service";
import { lastDigestRun, type DigestRunSummary } from "@/features/notifications/digest";
import type { DigestRunOutcome } from "@/features/notifications/model";
import { pushesThisMonth, type PushCount } from "@/features/notifications/quota";
import type { SyncOutcome } from "@/features/schedule/model";
import { lastSyncRun } from "@/features/schedule/service";
import { redactSecrets } from "@/lib/env";

export type SyncStatus =
  | { state: "never" }
  | {
      state: SyncOutcome;
      at: Date;
      source: string;
      shows: number;
      episodes: number;
      skipped: number;
      reason: string | null;
      lastSuccessAt: Date | null;
    };

export type DigestStatus =
  | { state: "never" }
  | {
      state: DigestRunOutcome;
      at: Date;
      day: string;
      recipients: number;
      enqueued: number;
      reason: string | null;
      deliveries: DigestRunSummary["deliveries"];
    };

export type AdminStatus = {
  sync: SyncStatus;
  digest: DigestStatus;
  pushes: PushCount;
  reminders: ReminderPlaces;
};

const REASON_MAX_LENGTH = 300;

function shownReason(error: string | null): string | null {
  if (error === null) return null;
  const safe = redactSecrets(error);
  return safe.length > REASON_MAX_LENGTH ? `${safe.slice(0, REASON_MAX_LENGTH - 1)}…` : safe;
}

export async function adminStatus(now: Date = new Date()): Promise<AdminStatus> {
  const [sync, digest, pushes, reminders] = await Promise.all([
    lastSyncRun(),
    lastDigestRun(),
    pushesThisMonth(now),
    reminderPlaces(),
  ]);
  const lastSuccess = sync?.outcome === "failure" ? await lastSyncRun("success") : sync;

  return {
    sync: sync
      ? {
          state: sync.outcome,
          at: sync.startedAt,
          source: sync.source,
          shows: sync.shows,
          episodes: sync.episodes,
          skipped: sync.skipped,
          reason: shownReason(sync.error),
          lastSuccessAt: lastSuccess?.startedAt ?? null,
        }
      : { state: "never" },
    digest: digest
      ? {
          state: digest.outcome,
          at: digest.startedAt,
          day: digest.day,
          recipients: digest.recipients,
          enqueued: digest.enqueued,
          reason: shownReason(digest.error),
          deliveries: digest.deliveries,
        }
      : { state: "never" },
    pushes,
    reminders,
  };
}
