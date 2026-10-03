import { Schema } from "mongoose";

import { defineModel, indexesReady } from "@/lib/db/mongoose";

const DELIVERY_STATUSES = ["sending", "sent", "failed", "refused"] as const;
export type DeliveryStatus = (typeof DELIVERY_STATUSES)[number];

export type DigestDeliveryDoc = {
  userId: string;
  day: string;
  status: DeliveryStatus;
  claimedAt: Date;
  attempts: number;
  sentAt: Date | null;
  error: string | null;
};

const DIGEST_RUN_OUTCOMES = ["enqueued", "skipped-stale", "failed"] as const;
export type DigestRunOutcome = (typeof DIGEST_RUN_OUTCOMES)[number];

export type DigestRunDoc = {
  startedAt: Date;
  finishedAt: Date;
  day: string;
  outcome: DigestRunOutcome;
  recipients: number;
  enqueued: number;
  lastSyncAt: Date | null;
  error: string | null;
};

export type PushQuotaDoc = {
  month: string;
  count: number;
  keys: string[];
};

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

export const DigestDelivery = defineModel("DigestDelivery", digestDeliverySchema);
export const DigestRun = defineModel("DigestRun", digestRunSchema);
export const PushQuota = defineModel("PushQuota", pushQuotaSchema);

export const ready = indexesReady(() =>
  Promise.all([
    DigestDelivery.createIndexes(),
    DigestRun.createIndexes(),
    PushQuota.createIndexes(),
  ]),
);
