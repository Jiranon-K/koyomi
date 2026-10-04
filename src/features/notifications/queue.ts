import { Client } from "@upstash/qstash";

export const JOB_NAMES = ["sync-schedule", "digest-fanout", "digest-send"] as const;
export type JobName = (typeof JOB_NAMES)[number];

export type JobPayload = Record<string, string | number | boolean | null>;

export type EnqueueOptions = {
  deduplicationId?: string;
};

export interface JobQueue {
  readonly name: "qstash" | "in-process";
  enqueue(job: JobName, payload: JobPayload, options?: EnqueueOptions): Promise<void>;
}

export function jobPath(job: JobName): string {
  return `/api/jobs/${job}`;
}

export function jobUrl(appUrl: string, job: JobName): string {
  return `${appUrl}${jobPath(job)}`;
}

// Why QStash could not call this origin, or undefined when it can. Both scripts that talk to a real
// QStash account check it first: a job published to an address QStash cannot reach only fails later.
export function publicOriginProblem(origin: string): string | undefined {
  const { hostname, protocol } = new URL(origin);
  if (protocol === "https:" && !["localhost", "127.0.0.1", "[::1]"].includes(hostname)) return;
  return `BETTER_AUTH_URL is ${origin}: QStash cannot reach it. Use a public HTTPS origin.`;
}

export const JOB_RETRIES = 3;

type QStashOptions = {
  token: string;
  url: string;
  appUrl: string;
};

export function createQStashQueue({ token, url, appUrl }: QStashOptions): JobQueue {
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

type JobRunner = (job: JobName, payload: JobPayload) => Promise<unknown>;

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
