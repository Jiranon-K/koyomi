import { Receiver } from "@upstash/qstash";

import { appUrl, qstashSigningEnv } from "@/lib/env";

import { runJob, type JobResult } from "./jobs";
import { jobUrl, type JobName } from "./queue";

export const SIGNATURE_HEADER = "upstash-signature";

/** Seconds of clock difference with QStash that the expiry and not-before checks forgive. */
const CLOCK_TOLERANCE_SECONDS = 5;

export type SigningKeys = { currentSigningKey: string; nextSigningKey: string };

/**
 * True when `signature` is a token QStash signed for exactly this call. QStash signs with a JWT
 * (HS256, under the current or, during a key rotation, the next signing key) that names the
 * issuer, the URL it calls (the subject), an expiry and the SHA-256 of the body. The official
 * receiver checks all of those; anything it objects to, or cannot read, is a refusal.
 */
export async function isSignedByQStash(
  request: { signature: string | null; rawBody: string; url: string },
  keys: SigningKeys,
): Promise<boolean> {
  if (!request.signature) return false;
  // `devMode: false`: the receiver must never fall back to the public development keys.
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
  /** Defaults to the configured QStash signing keys. */
  signingKeys?: SigningKeys | undefined;
  /** Defaults to this app's public origin. */
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

// QStash stops retrying when it is told the failure is permanent.
function notRetryable(message: string): Response {
  return new Response(message, { status: 489, headers: { "Upstash-NonRetryable-Error": "true" } });
}

/**
 * Every job Route Handler is this function. In order: refuse when the signing keys are not
 * configured (there is no unsigned mode, not even with the fakes on), refuse a missing or bad
 * signature, and only then read the payload and run the job. A status outside 2xx makes QStash
 * try again later, so a finished job answers 200 whatever its outcome was, and 500 only when
 * running it again can help.
 */
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
