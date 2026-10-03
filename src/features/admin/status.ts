import { reminderPlaces, type ReminderPlaces } from "@/features/line/service";
import { lastDigestRun, type DigestRunSummary } from "@/features/notifications/digest";
import type { DigestRunOutcome } from "@/features/notifications/model";
import { pushesThisMonth, type PushCount } from "@/features/notifications/quota";
import type { SyncOutcome } from "@/features/schedule/model";
import { lastSyncRun } from "@/features/schedule/service";
import { redactSecrets } from "@/lib/env";

// What the admin status page shows: one read of what the background work last did. Nothing here
// writes, and nothing here is per user.

export type SyncStatus =
  | { state: "never" }
  | {
      state: SyncOutcome;
      /** When the run started. */
      at: Date;
      source: string;
      shows: number;
      episodes: number;
      skipped: number;
      /** Why it failed, safe to show; null for a success. */
      reason: string | null;
      /** When the last successful sync started: this run when it succeeded, or one before it. */
      lastSuccessAt: Date | null;
    };

export type DigestStatus =
  | { state: "never" }
  | {
      state: DigestRunOutcome;
      /** When the fan-out started. */
      at: Date;
      /** The schedule day it was for, `YYYY-MM-DD`. */
      day: string;
      /** Users with reminders on when the run looked. */
      recipients: number;
      /** Of those, the ones with something airing: one per-user job each. */
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

/**
 * A stored failure reason, made fit for the page. The schedule source words its own errors without
 * the token, but a sync can also fail on an error a library threw, whose message this app does not
 * control; so every reason is passed through `redactSecrets` and kept short.
 */
function shownReason(error: string | null): string | null {
  if (error === null) return null;
  const safe = redactSecrets(error);
  return safe.length > REASON_MAX_LENGTH ? `${safe.slice(0, REASON_MAX_LENGTH - 1)}…` : safe;
}

export async function adminStatus(now: Date = new Date()): Promise<AdminStatus> {
  const [sync, success, digest, pushes, reminders] = await Promise.all([
    lastSyncRun(),
    lastSyncRun("success"),
    lastDigestRun(),
    pushesThisMonth(now),
    reminderPlaces(),
  ]);

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
          lastSuccessAt: success?.startedAt ?? null,
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
