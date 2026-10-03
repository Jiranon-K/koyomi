import type { Metadata } from "next";

import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { adminStatus, type DigestStatus, type SyncStatus } from "@/features/admin/status";
import { SyncNowButton } from "@/features/admin/sync-now-button";
import { requireAdmin } from "@/features/auth/session";
import { formatDateTime, formatDayDate } from "@/features/schedule/day-window";

export const metadata: Metadata = { title: "Status" };

function Row({
  label,
  state,
  failed = false,
  children,
}: {
  label: string;
  state: string;
  failed?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <StaggerItem className="grid gap-x-4 gap-y-3 border-b border-border py-5 sm:grid-cols-[7rem_1fr]">
      <dt className="pt-1.5 label-mono text-muted-foreground">{label}</dt>
      <dd className="grid gap-3">
        <p className={failed ? "text-lg leading-snug text-destructive" : "text-lg leading-snug"}>
          {state}
        </p>
        {children}
      </dd>
    </StaggerItem>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground">{children}</p>;
}

function Reason({ children }: { children: string | null }) {
  return children ? <p className="text-sm break-words">Reason: {children}</p> : null;
}

const SYNC_STATE = { never: "Never run", success: "Succeeded", failure: "Failed" } as const;

function SyncRow({ sync }: { sync: SyncStatus }) {
  return (
    <Row label="Sync" state={SYNC_STATE[sync.state]} failed={sync.state === "failure"}>
      {sync.state === "never" ? <Note>The schedule has not been synced yet.</Note> : null}
      {sync.state === "success" ? (
        <Note>
          {formatDateTime(sync.at)}, Thai time. {sync.episodes} episodes of {sync.shows} shows from{" "}
          {sync.source}
          {sync.skipped ? `, ${sync.skipped} skipped` : ""}.
        </Note>
      ) : null}
      {sync.state === "failure" ? (
        <>
          <Note>
            {formatDateTime(sync.at)}, Thai time, from {sync.source}.
          </Note>
          <Reason>{sync.reason}</Reason>
          <Note>
            {sync.lastSuccessAt
              ? `Last successful sync: ${formatDateTime(sync.lastSuccessAt)}.`
              : "No sync has succeeded yet."}
          </Note>
        </>
      ) : null}
      <SyncNowButton />
    </Row>
  );
}

const DIGEST_STATE = {
  never: "Never run",
  enqueued: "Ran",
  "skipped-stale": "Skipped",
  failed: "Failed",
} as const;

function DigestRow({ digest }: { digest: DigestStatus }) {
  if (digest.state === "never") {
    return (
      <Row label="Digest" state={DIGEST_STATE.never}>
        <Note>The 09:00 digest has not run yet.</Note>
      </Row>
    );
  }
  const { sent, refusedQuota, failed, inProgress } = digest.deliveries;
  return (
    <Row label="Digest" state={DIGEST_STATE[digest.state]} failed={digest.state === "failed"}>
      <Note>
        {formatDateTime(digest.at)}, Thai time, for {formatDayDate(digest.day)}.{" "}
        {digest.state === "skipped-stale"
          ? "Nothing was sent: the schedule had no successful sync in the 24 hours before it."
          : `${digest.enqueued} of ${digest.recipients} users with reminders on had something airing.`}
      </Note>
      <Reason>{digest.reason}</Reason>
      <Note>
        Deliveries for that day: {sent} sent, {refusedQuota} refused by the quota, {failed} failed,{" "}
        {inProgress} in progress.
      </Note>
    </Row>
  );
}

export default async function AdminPage() {
  await requireAdmin();
  const now = new Date();
  const { sync, digest, pushes, reminders } = await adminStatus(now);

  return (
    <Stagger className="max-w-2xl">
      <StaggerItem>
        <h1 className="font-display text-5xl leading-none">Status</h1>
      </StaggerItem>
      <StaggerItem>
        <p className="mt-2 text-muted-foreground">
          What the background work last did, as of {formatDateTime(now)}, Thai time.
        </p>
      </StaggerItem>

      <dl className="mt-10 border-t border-foreground">
        <SyncRow sync={sync} />
        <DigestRow digest={digest} />
        <Row label="Pushes" state={`${pushes.count} / ${pushes.limit}`}>
          <Note>
            LINE pushes counted in {pushes.month}, the Bangkok calendar month. Replies to messages
            are free and are not counted.
          </Note>
        </Row>
        <Row label="Reminders" state={`${reminders.taken} / ${reminders.cap}`}>
          <Note>
            Users with reminders switched on. {reminders.reachable} of them are friends of the bot,
            so a digest can reach them.
          </Note>
        </Row>
      </dl>
    </Stagger>
  );
}
