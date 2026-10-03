import mongoose, { Schema, type Model } from "mongoose";

import { connectDb } from "@/lib/db/mongoose";

/**
 * `sending`: a job holds the claim (until its lease runs out). `sent`: delivered, final.
 * `failed`: the push did not go out and may be tried again. `refused`: the monthly quota said no.
 */
export const DELIVERY_STATUSES = ["sending", "sent", "failed", "refused"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

/** One digest for one user on one schedule day. The unique key is what stops a second send. */
export type DigestDeliveryDoc = {
  userId: string;
  /** The schedule day, `YYYY-MM-DD` (see `day-window.ts`). */
  day: string;
  status: DeliveryStatus;
  /** When the current (or last) attempt took the claim. */
  claimedAt: Date;
  attempts: number;
  sentAt: Date | null;
  /** Why the last attempt did not send; never holds a secret. */
  error: string | null;
};

export const DIGEST_RUN_OUTCOMES = ["enqueued", "skipped-stale", "failed"] as const;
export type DigestRunOutcome = (typeof DIGEST_RUN_OUTCOMES)[number];

/** One run of the 09:00 fan-out job. What each per-user job then did is in `DigestDelivery`. */
export type DigestRunDoc = {
  startedAt: Date;
  finishedAt: Date;
  day: string;
  outcome: DigestRunOutcome;
  /** Users with reminders on when the run looked. */
  recipients: number;
  /** Per-user jobs enqueued: recipients with a followed episode in the day's window. */
  enqueued: number;
  /** When the last successful sync started, as the run saw it; null when there was none. */
  lastSyncAt: Date | null;
  error: string | null;
};

/** Pushes counted in one Bangkok calendar month. `keys` makes counting a push idempotent. */
export type PushQuotaDoc = {
  /** `YYYY-MM`. */
  month: string;
  count: number;
  /** The retry key of every counted push. */
  keys: string[];
};

// Indexes are created by the services once the connection is up (`bufferCommands` is off).
const options = { autoIndex: false } as const;

const digestDeliverySchema = new Schema<DigestDeliveryDoc>(
  {
    userId: { type: String, required: true },
    day: { type: String, required: true },
    status: { type: String, required: true, enum: DELIVERY_STATUSES },
    claimedAt: { type: Date, required: true },
    attempts: { type: Number, required: true },
    sentAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  options,
);
// One digest per user and schedule day; the day prefix also serves "everything sent that day".
digestDeliverySchema.index({ day: 1, userId: 1 }, { unique: true });

const digestRunSchema = new Schema<DigestRunDoc>(
  {
    startedAt: { type: Date, required: true },
    finishedAt: { type: Date, required: true },
    day: { type: String, required: true },
    outcome: { type: String, required: true, enum: DIGEST_RUN_OUTCOMES },
    recipients: { type: Number, required: true },
    enqueued: { type: Number, required: true },
    lastSyncAt: { type: Date, default: null },
    error: { type: String, default: null },
  },
  options,
);
digestRunSchema.index({ startedAt: -1 });

const pushQuotaSchema = new Schema<PushQuotaDoc>(
  {
    month: { type: String, required: true },
    count: { type: Number, required: true },
    keys: { type: [String], required: true },
  },
  options,
);
pushQuotaSchema.index({ month: 1 }, { unique: true });

// Next.js reloads modules in development; reuse a model that is already compiled.
function model<Doc>(name: string, schema: Schema<Doc>): Model<Doc> {
  const existing = mongoose.models[name] as Model<Doc> | undefined;
  return existing ?? mongoose.model<Doc>(name, schema);
}

export const DigestDelivery = model("DigestDelivery", digestDeliverySchema);
export const DigestRun = model("DigestRun", digestRunSchema);
export const PushQuota = model("PushQuota", pushQuotaSchema);

let indexes: Promise<unknown> | null = null;

/**
 * Connects and builds the indexes once per process. Every service function starts here: the
 * "send once" and quota guarantees rest on the unique indexes, so they must exist before a write.
 */
export async function ready(): Promise<void> {
  await connectDb();
  const building = (indexes ??= Promise.all([
    DigestDelivery.createIndexes(),
    DigestRun.createIndexes(),
    PushQuota.createIndexes(),
  ]));
  try {
    await building;
  } catch (error) {
    if (indexes === building) indexes = null;
    throw error;
  }
}
