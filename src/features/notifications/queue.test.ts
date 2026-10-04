import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createInProcessQueue,
  createQStashQueue,
  jobPath,
  jobUrl,
  JOB_NAMES,
  publicOriginProblem,
} from "./queue";

const TOKEN = "test-qstash-token";
const APP = "https://koyomi.example";

afterEach(() => {
  vi.restoreAllMocks();
});

function qstashAnswers(response: () => Response) {
  const calls: { url: string; headers: Headers; body: string }[] = [];
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    calls.push({
      url: String(input),
      headers: new Headers(init?.headers),
      body: String(init?.body),
    });
    return response();
  });
  return calls;
}

describe("job addresses", () => {
  it("puts every job under /api/jobs on this app's origin", () => {
    expect(JOB_NAMES.map(jobPath)).toEqual([
      "/api/jobs/sync-schedule",
      "/api/jobs/digest-fanout",
      "/api/jobs/digest-send",
    ]);
    expect(jobUrl(APP, "digest-send")).toBe("https://koyomi.example/api/jobs/digest-send");
  });
});

describe("publicOriginProblem", () => {
  it("accepts an HTTPS origin on a public host", () => {
    expect(publicOriginProblem("https://koyomi.example")).toBeUndefined();
    expect(publicOriginProblem("https://odd-words.trycloudflare.com")).toBeUndefined();
  });

  it.each([
    ["plain HTTP", "http://koyomi.example"],
    ["localhost", "https://localhost"],
    ["the loopback address", "https://127.0.0.1"],
    ["the IPv6 loopback address", "https://[::1]"],
  ])("explains why %s cannot be reached by QStash", (_name, origin) => {
    expect(publicOriginProblem(origin)).toContain(origin);
  });
});

describe("the QStash queue", () => {
  const queue = () =>
    createQStashQueue({ token: TOKEN, url: "https://qstash.upstash.io", appUrl: APP });

  it("publishes the payload to the job's URL with the token and the de-duplication id", async () => {
    const calls = qstashAnswers(() => Response.json({ messageId: "msg-1" }));

    await queue().enqueue(
      "digest-send",
      { userId: "user-ada", day: "2026-10-03" },
      { deduplicationId: "digest-2026-10-03-user-ada" },
    );

    expect(calls).toHaveLength(1);
    expect(calls[0]?.url).toBe(
      "https://qstash.upstash.io/v2/publish/https://koyomi.example/api/jobs/digest-send",
    );
    expect(calls[0]?.headers.get("authorization")).toBe(`Bearer ${TOKEN}`);
    expect(calls[0]?.headers.get("content-type")).toBe("application/json");
    expect(calls[0]?.headers.get("upstash-deduplication-id")).toBe("digest-2026-10-03-user-ada");
    expect(calls[0]?.headers.get("upstash-retries")).toBe("3");
    expect(JSON.parse(calls[0]?.body ?? "")).toEqual({ userId: "user-ada", day: "2026-10-03" });
  });

  it("sends no de-duplication id unless one is given", async () => {
    const calls = qstashAnswers(() => Response.json({ messageId: "msg-1" }));

    await queue().enqueue("digest-fanout", {});

    expect(calls[0]?.headers.has("upstash-deduplication-id")).toBe(false);
  });

  it("rejects when QStash refuses the job, without the token in the error", async () => {
    qstashAnswers(() => Response.json({ error: "unauthorized" }, { status: 401 }));

    const failure = await queue()
      .enqueue("digest-fanout", {})
      .then(
        () => null,
        (error: unknown) => error,
      );

    expect(failure).toBeInstanceOf(Error);
    expect(String(failure)).not.toContain(TOKEN);
  });
});

describe("the in-process queue", () => {
  it("runs the job at once with its payload", async () => {
    const run = vi.fn(async () => undefined);

    await createInProcessQueue(run).enqueue("digest-send", { userId: "user-ada" });

    expect(run).toHaveBeenCalledExactlyOnceWith("digest-send", { userId: "user-ada" });
  });

  it("accepts the job even when it fails, as a real queue would", async () => {
    const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
    const run = vi.fn(async () => {
      throw new Error("job blew up");
    });

    await expect(createInProcessQueue(run).enqueue("digest-fanout", {})).resolves.toBeUndefined();

    expect(logged).toHaveBeenCalledOnce();
  });
});
