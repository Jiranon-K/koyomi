import { Client } from "@upstash/qstash";

// Background work is a named job with a small JSON payload. In production a job is an HTTPS call
// that QStash makes to this app (`/api/jobs/<name>`, signature-checked in `job-route.ts`); QStash
// retries a call that does not answer 2xx. The handlers themselves are in `jobs.ts`.

export const JOB_NAMES = ["sync-schedule", "digest-fanout", "digest-send"] as const;
export type JobName = (typeof JOB_NAMES)[number];

export type JobPayload = Record<string, string | number | boolean | null>;

export type EnqueueOptions = {
  /** The queue drops a job whose id it has already accepted, so enqueueing twice runs it once. */
  deduplicationId?: string;
};

export interface JobQueue {
  readonly name: "qstash" | "in-process";
  /** Hands a job over for execution. Resolves once the queue has accepted it. */
  enqueue(job: JobName, payload: JobPayload, options?: EnqueueOptions): Promise<void>;
}

export function jobPath(job: JobName): string {
  return `/api/jobs/${job}`;
}

/** The address QStash calls for a job. The signature check expects exactly this as the subject. */
export function jobUrl(appUrl: string, job: JobName): string {
  return `${appUrl}${jobPath(job)}`;
}

/** How often QStash tries a job again after the first call fails. */
export const JOB_RETRIES = 3;

type QStashOptions = {
  token: string;
  /** The QStash API address of the account's region. */
  url: string;
  /** This app's public origin; QStash must be able to reach it. */
  appUrl: string;
};

/** The real queue: publishes each job to QStash, which calls the job's URL. */
export function createQStashQueue({ token, url, appUrl }: QStashOptions): JobQueue {
  // `devMode: false`: never fall back to the SDK's local development server and its public keys.
  const client = new Client({ token, baseUrl: url, devMode: false, enableTelemetry: false });
  return {
    name: "qstash",
    async enqueue(job, payload, options = {}) {
      await client.publishJSON({
        url: jobUrl(appUrl, job),
        body: payload,
        retries: JOB_RETRIES,
        ...(options.deduplicationId ? { deduplicationId: options.deduplicationId } : {}),
      });
    },
  };
}

export type JobRunner = (job: JobName, payload: JobPayload) => Promise<unknown>;

/**
 * The fake queue: runs the job at once, inside this process, so the whole flow works without a
 * network. Like a real queue it accepts the job whatever the job then does: a job that fails is
 * logged, not thrown back at the caller. Unlike QStash it does not retry and does not
 * de-duplicate, so a job enqueued twice runs twice and must cope on its own.
 */
export function createInProcessQueue(run: JobRunner): JobQueue {
  return {
    name: "in-process",
    async enqueue(job, payload) {
      try {
        await run(job, payload);
      } catch (error) {
        console.error(
          `[jobs] ${job} failed in process:`,
          error instanceof Error ? error.message : error,
        );
      }
    },
  };
}
