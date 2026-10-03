import { afterEach, describe, expect, it, vi } from "vitest";

import { handleJobRequest, isSignedByQStash } from "./job-route";
import type { JobResult } from "./jobs";
import { jobUrl, type JobName } from "./queue";
import { signJob } from "./test-helpers";

vi.mock("next/cache", () => ({ revalidateTag: vi.fn(), unstable_cache: (load: unknown) => load }));

const CURRENT = "test-current-signing-key";
const NEXT = "test-next-signing-key";
const KEYS = { currentSigningKey: CURRENT, nextSigningKey: NEXT };
const APP = "https://koyomi.example";
const URL_SEND = jobUrl(APP, "digest-send");
const BODY = JSON.stringify({ userId: "user-ada", day: "2026-10-03" });
const saved = { ...process.env };

afterEach(() => {
  process.env = { ...saved };
  vi.restoreAllMocks();
});

function jobRequest(body: string, signature: string | null, url = URL_SEND) {
  return new Request(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(signature === null ? {} : { "upstash-signature": signature }),
    },
    body,
  });
}

/** Stands in for the job itself, so a test can see whether it was reached and with what. */
function spyJob(result: JobResult = { status: "ran", retry: false, result: { outcome: "sent" } }) {
  return vi.fn(async (job: JobName, payload: unknown) => {
    void job;
    void payload;
    return result;
  });
}

function call(
  signature: string | null,
  options: { body?: string; run?: ReturnType<typeof spyJob>; job?: JobName } = {},
) {
  const run = options.run ?? spyJob();
  const job = options.job ?? "digest-send";
  const response = handleJobRequest(jobRequest(options.body ?? BODY, signature), job, {
    signingKeys: KEYS,
    appUrl: APP,
    run,
  });
  return { response, run };
}

describe("a correctly signed job call", () => {
  it("runs the job with the parsed payload and answers 200 with its result", async () => {
    const { response, run } = call(signJob({ key: CURRENT, url: URL_SEND, body: BODY }));

    expect((await response).status).toBe(200);
    expect(await (await response).json()).toEqual({ outcome: "sent" });
    expect(run).toHaveBeenCalledExactlyOnceWith("digest-send", {
      userId: "user-ada",
      day: "2026-10-03",
    });
  });

  it("is accepted under the next signing key, for the time around a key rotation", async () => {
    const { response, run } = call(signJob({ key: NEXT, url: URL_SEND, body: BODY }));

    expect((await response).status).toBe(200);
    expect(run).toHaveBeenCalledOnce();
  });

  it("treats the empty body of a scheduled call as an empty payload", async () => {
    const url = jobUrl(APP, "digest-fanout");
    const { response, run } = call(signJob({ key: CURRENT, url, body: "" }), {
      body: "",
      job: "digest-fanout",
    });

    expect((await response).status).toBe(200);
    expect(run).toHaveBeenCalledExactlyOnceWith("digest-fanout", {});
  });

  it("answers 500 when the job asks to be run again, so that QStash retries", async () => {
    const run = spyJob({ status: "ran", retry: true, result: { outcome: "failed" } });
    const { response } = call(signJob({ key: CURRENT, url: URL_SEND, body: BODY }), { run });

    expect((await response).status).toBe(500);
    expect(await (await response).json()).toEqual({ outcome: "failed" });
  });

  it("answers 200 for a refused push: retrying cannot help, so QStash must not", async () => {
    const run = spyJob({ status: "ran", retry: false, result: { outcome: "refused-quota" } });
    const { response } = call(signJob({ key: CURRENT, url: URL_SEND, body: BODY }), { run });

    expect((await response).status).toBe(200);
    expect(await (await response).json()).toEqual({ outcome: "refused-quota" });
  });

  it("answers 500 without details when the job throws", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = vi.fn(async () => {
      throw new Error("database is down");
    });
    const { response } = call(signJob({ key: CURRENT, url: URL_SEND, body: BODY }), { run });

    expect((await response).status).toBe(500);
    expect(await (await response).text()).toBe("The job failed");
    expect(logged).toHaveBeenCalledOnce();
  });

  it.each([
    ["a payload the job does not take", spyJob({ status: "invalid" }), BODY],
    ["a body that is not JSON", spyJob(), "not json"],
  ])("tells QStash not to retry %s", async (_, run, body) => {
    const { response } = call(signJob({ key: CURRENT, url: URL_SEND, body }), { run, body });

    expect((await response).status).toBe(489);
    expect((await response).headers.get("upstash-nonretryable-error")).toBe("true");
  });
});

describe("a job call that QStash did not sign", () => {
  const good = () => signJob({ key: CURRENT, url: URL_SEND, body: BODY });
  const tamperedClaims = () => {
    const [header = "", , signature = ""] = good().split(".");
    const claims = Buffer.from(JSON.stringify({ iss: "Upstash", sub: URL_SEND })).toString(
      "base64url",
    );
    return `${header}.${claims}.${signature}`;
  };

  it.each<[string, () => string | null, string?]>([
    ["no signature header", () => null],
    ["an empty signature", () => ""],
    ["a signature that is not a token", () => "not-a-jwt"],
    ["a token signed with another key", () => signJob({ key: "wrong", url: URL_SEND, body: BODY })],
    ["a token for a different body", () => signJob({ key: CURRENT, url: URL_SEND, body: "{}" })],
    [
      "a token for another job's URL",
      () => signJob({ key: CURRENT, url: jobUrl(APP, "sync-schedule"), body: BODY }),
    ],
    [
      "a token for the same path on another host",
      () =>
        signJob({ key: CURRENT, url: URL_SEND.replace(APP, "https://evil.example"), body: BODY }),
    ],
    [
      "a token from another issuer",
      () => signJob({ key: CURRENT, url: URL_SEND, body: BODY, issuer: "Someone" }),
    ],
    [
      "an expired token",
      () => signJob({ key: CURRENT, url: URL_SEND, body: BODY, expiresIn: -60 }),
    ],
    [
      "an unsigned token (alg none)",
      () => signJob({ key: CURRENT, url: URL_SEND, body: BODY, algorithm: "none" }),
    ],
    ["a token whose claims were changed after signing", tamperedClaims],
    ["the signing key itself", () => CURRENT],
  ])("refuses %s with 401 and never runs the job", async (_, signature) => {
    const { response, run } = call(signature());

    expect((await response).status).toBe(401);
    expect(await (await response).text()).toBe("Invalid signature");
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses a bad signature with the fakes on too", async () => {
    process.env.USE_FAKES = "true";

    const unsigned = call(null);
    const forged = call(signJob({ key: "wrong", url: URL_SEND, body: BODY }));

    expect((await unsigned.response).status).toBe(401);
    expect((await forged.response).status).toBe(401);
    expect(unsigned.run).not.toHaveBeenCalled();
    expect(forged.run).not.toHaveBeenCalled();
  });

  it("decides on the raw body: the same JSON with other spacing does not match", async () => {
    const signature = signJob({ key: CURRENT, url: URL_SEND, body: BODY });
    const { response, run } = call(signature, { body: JSON.stringify(JSON.parse(BODY), null, 2) });

    expect((await response).status).toBe(401);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("while the signing keys are not configured", () => {
  it.each(["true", "false"])("refuses every call with 503 (USE_FAKES=%s)", async (fakes) => {
    process.env.USE_FAKES = fakes;
    delete process.env.QSTASH_CURRENT_SIGNING_KEY;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    const run = spyJob();

    for (const signature of [null, signJob({ key: "", url: URL_SEND, body: BODY })]) {
      const response = await handleJobRequest(jobRequest(BODY, signature), "digest-send", {
        appUrl: APP,
        run,
      });
      expect(response.status).toBe(503);
    }
    expect(run).not.toHaveBeenCalled();
  });

  it("refuses with only one of the two keys set", async () => {
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT;
    delete process.env.QSTASH_NEXT_SIGNING_KEY;
    const run = spyJob();

    const response = await handleJobRequest(
      jobRequest(BODY, signJob({ key: CURRENT, url: URL_SEND, body: BODY })),
      "digest-send",
      { appUrl: APP, run },
    );

    expect(response.status).toBe(503);
    expect(run).not.toHaveBeenCalled();
  });
});

describe("with the keys and the origin taken from the environment", () => {
  it("accepts a call signed for this app's own job URL, and no other", async () => {
    process.env.QSTASH_CURRENT_SIGNING_KEY = CURRENT;
    process.env.QSTASH_NEXT_SIGNING_KEY = NEXT;
    process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
    process.env.BETTER_AUTH_URL = APP;
    const run = spyJob();
    // The request reaches the server under an internal address; the signature names the public one.
    const internal = "http://127.0.0.1:3000/api/jobs/digest-send";

    const signed = await handleJobRequest(
      jobRequest(BODY, signJob({ key: CURRENT, url: URL_SEND, body: BODY }), internal),
      "digest-send",
      { run },
    );
    const forInternal = await handleJobRequest(
      jobRequest(BODY, signJob({ key: CURRENT, url: internal, body: BODY }), internal),
      "digest-send",
      { run },
    );

    expect(signed.status).toBe(200);
    expect(forInternal.status).toBe(401);
    expect(run).toHaveBeenCalledOnce();
  });
});

describe("isSignedByQStash", () => {
  it("ignores QSTASH_DEV: the public development keys never verify a call", async () => {
    process.env.QSTASH_DEV = "true";
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const request = {
      signature: signJob({ key: CURRENT, url: URL_SEND, body: BODY }),
      rawBody: BODY,
      url: URL_SEND,
    };

    expect(await isSignedByQStash(request, KEYS)).toBe(true);
    expect(await isSignedByQStash(request, { currentSigningKey: "a", nextSigningKey: "b" })).toBe(
      false,
    );
    expect(warn).not.toHaveBeenCalled();
  });
});
