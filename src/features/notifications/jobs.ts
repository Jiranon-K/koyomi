import * as z from "zod";

import { DASHBOARD_PATH } from "@/features/auth/paths";
import { lineMessenger } from "@/features/line/messenger";
import { isScheduleDay } from "@/features/schedule/day-window";
import { runScheduleSync } from "@/features/schedule/sync";
import { appUrl, fakesEnabled, qstashEnv } from "@/lib/env";

import { fanOutDigest, sendDigest } from "./digest";
import {
  createInProcessQueue,
  createQStashQueue,
  type JobName,
  type JobPayload,
  type JobQueue,
} from "./queue";

export type JobResult =
  { status: "invalid" } | { status: "ran"; retry: boolean; result: JobPayload };

const noPayload = z.unknown().transform(() => ({}));

const digestSendPayload = z.object({
  userId: z.string().min(1).max(200),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isScheduleDay),
});

type Ran = { retry: boolean; result: JobPayload };

type Job<Payload> = { payload: z.ZodType<Payload>; run(payload: Payload): Promise<Ran> };

const job = <Payload>(definition: Job<Payload>) => definition;

const syncScheduleJob = job({
  payload: noPayload,
  async run() {
    const run = await runScheduleSync();
    return {
      retry: run.outcome !== "success",
      result: { outcome: run.outcome, episodes: run.episodes },
    };
  },
});

const digestFanoutJob = job({
  payload: noPayload,
  async run() {
    const { outcome, day, recipients, enqueued } = await fanOutDigest(jobQueue());
    return { retry: false, result: { outcome, day, recipients, enqueued } };
  },
});

const digestSendJob = job({
  payload: digestSendPayload,
  async run(target) {
    const outcome = await sendDigest(target, {
      messenger: lineMessenger(),
      dashboardUrl: `${appUrl()}${DASHBOARD_PATH}`,
    });
    return {
      retry: outcome.kind === "failed" || outcome.kind === "in-progress",
      result: { outcome: outcome.kind },
    };
  },
});

async function runWith<Payload>(definition: Job<Payload>, payload: unknown): Promise<JobResult> {
  const parsed = definition.payload.safeParse(payload);
  if (!parsed.success) return { status: "invalid" };
  return { status: "ran", ...(await definition.run(parsed.data)) };
}

export async function runJob(name: JobName, payload: unknown): Promise<JobResult> {
  switch (name) {
    case "sync-schedule":
      return runWith(syncScheduleJob, payload);
    case "digest-fanout":
      return runWith(digestFanoutJob, payload);
    case "digest-send":
      return runWith(digestSendJob, payload);
  }
}

export function jobQueue(): JobQueue {
  if (fakesEnabled()) return createInProcessQueue(runJob);
  return createQStashQueue({ ...qstashEnv(), appUrl: appUrl() });
}
