import { Receiver } from "@upstash/qstash";

import { appUrl, qstashSigningEnv } from "@/lib/env";

import { runJob, type JobResult } from "./jobs";
import { jobUrl, type JobName } from "./queue";

const SIGNATURE_HEADER = "upstash-signature";

const CLOCK_TOLERANCE_SECONDS = 5;

export type SigningKeys = { currentSigningKey: string; nextSigningKey: string };

export async function isSignedByQStash(
  request: { signature: string | null; rawBody: string; url: string },
  keys: SigningKeys,
): Promise<boolean> {
  if (!request.signature) return false;
  const receiver = new Receiver({ ...keys, devMode: false });
  try {
    return await receiver.verify({
      signature: request.signature,
      body: request.rawBody,
      url: request.url,
      clockTolerance: CLOCK_TOLERANCE_SECONDS,
    });
  } catch {
    return false;
  }
}

type JobRouteOptions = {
  signingKeys?: SigningKeys | undefined;
  appUrl?: string;
  run?: (job: JobName, payload: unknown) => Promise<JobResult>;
};

function parsePayload(rawBody: string): { ok: true; payload: unknown } | { ok: false } {
  if (rawBody.trim() === "") return { ok: true, payload: {} };
  try {
    return { ok: true, payload: JSON.parse(rawBody) };
  } catch {
    return { ok: false };
  }
}

function notRetryable(message: string): Response {
  return new Response(message, { status: 489, headers: { "Upstash-NonRetryable-Error": "true" } });
}

export async function handleJobRequest(
  request: Request,
  job: JobName,
  options: JobRouteOptions = {},
): Promise<Response> {
  const keys = "signingKeys" in options ? options.signingKeys : qstashSigningEnv();
  if (!keys) return new Response("Job endpoints are not configured", { status: 503 });

  const rawBody = await request.text();
  const signed = await isSignedByQStash(
    {
      signature: request.headers.get(SIGNATURE_HEADER),
      rawBody,
      url: jobUrl(options.appUrl ?? appUrl(), job),
    },
    keys,
  );
  if (!signed) return new Response("Invalid signature", { status: 401 });

  const body = parsePayload(rawBody);
  if (!body.ok) return notRetryable("The payload is not JSON");

  let outcome: JobResult;
  try {
    outcome = await (options.run ?? runJob)(job, body.payload);
  } catch (error) {
    console.error(`[jobs] ${job} failed:`, error instanceof Error ? error.message : error);
    return new Response("The job failed", { status: 500 });
  }
  if (outcome.status === "invalid") return notRetryable("The payload is not valid for this job");
  return Response.json(outcome.result, { status: outcome.retry ? 500 : 200 });
}
