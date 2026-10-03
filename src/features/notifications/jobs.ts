import * as z from "zod";

import { DASHBOARD_PATH } from "@/features/auth/paths";
import { lineMessenger } from "@/features/line/messenger";
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

// What each job does. A job is reached in two ways only: through its signature-checked Route
// Handler (`job-route.ts`), or in process through the fake queue. Nothing here checks who is
// calling, so never call `runJob` from anywhere else.

export type JobResult =
  /** The payload is not what the job takes; running it again cannot help. */
  | { status: "invalid" }
  /** The job ran. `retry` asks the queue to run it again later. */
  | { status: "ran"; retry: boolean; result: JobPayload };

// A scheduled call carries no payload of its own; whatever it sends is ignored.
const noPayload = z.unknown().transform(() => ({}));

function isCalendarDay(day: string): boolean {
  const parsed = Date.parse(`${day}T00:00:00Z`);
  // The parser rolls 30 February over into March; a real date comes back unchanged.
  return !Number.isNaN(parsed) && new Date(parsed).toISOString().slice(0, 10) === day;
}

const digestSendPayload = z.object({
  userId: z.string().min(1).max(200),
  day: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine(isCalendarDay),
});

type Ran = { retry: boolean; result: JobPayload };

type Job<Payload> = { payload: z.ZodType<Payload>; run(payload: Payload): Promise<Ran> };

const job = <Payload>(definition: Job<Payload>) => definition;

const syncScheduleJob = job({
  payload: noPayload,
  async run() {
    const run = await runScheduleSync();
    // A failed sync is already recorded; asking for a retry gives the 08:45 run a second chance.
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
    // A refused push is final for the month; only a failed or contended send is worth a retry.
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

/** Validates the payload and runs the job. Throws when the job itself fails unexpectedly. */
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

/**
 * The queue the environment selects. With `USE_FAKES` the job runs in this process straight away;
 * otherwise it is published to QStash, which calls the job's Route Handler.
 */
export function jobQueue(): JobQueue {
  if (fakesEnabled()) return createInProcessQueue(runJob);
  return createQStashQueue({ ...qstashEnv(), appUrl: appUrl() });
}
