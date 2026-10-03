import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { LineMessenger, SendResult } from "@/features/line/messenger";

import { PushQuota } from "./model";
import { PUSH_LIMIT, pushesThisMonth, pushWithinQuota, quotaMonth } from "./quota";

const NOW = new Date("2026-10-03T02:00:00Z");
const saved = { ...process.env };

let server: MongoMemoryServer;

function recorder(answer: () => SendResult | Promise<SendResult> = () => ({ ok: true })) {
  const pushed: { lineUserId: string; text: string; retryKey: string }[] = [];
  const messenger: LineMessenger = {
    name: "fake",
    async push(lineUserId, text, retryKey) {
      pushed.push({ lineUserId, text, retryKey });
      return answer();
    },
    async reply() {
      throw new Error("Nothing here replies.");
    },
  };
  return { messenger, pushed };
}

const push = (n: number) => ({ lineUserId: `U-${n}`, text: `message ${n}`, retryKey: `key-${n}` });

async function fill(count: number, now = NOW) {
  await PushQuota.create({
    month: quotaMonth(now),
    count,
    keys: Array.from({ length: count }, (_, index) => `filled-${index}`),
  });
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("quota-test");
});

afterAll(async () => {
  process.env = { ...saved };
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  await pushesThisMonth(NOW);
  await PushQuota.deleteMany({});
});

describe("quotaMonth", () => {
  it("is the Bangkok calendar month, not the UTC one", () => {
    expect(quotaMonth(new Date("2026-10-31T16:59:59Z"))).toBe("2026-10");
    expect(quotaMonth(new Date("2026-10-31T17:00:00Z"))).toBe("2026-11");
    expect(quotaMonth(new Date("2026-12-31T17:00:00Z"))).toBe("2027-01");
  });
});

describe("pushWithinQuota", () => {
  it("is 290 a month", () => {
    expect(PUSH_LIMIT).toBe(290);
  });

  it("sends through the messenger and counts the push", async () => {
    const { messenger, pushed } = recorder();

    expect(await pushWithinQuota(messenger, push(1), NOW)).toEqual({ kind: "sent" });

    expect(pushed).toEqual([push(1)]);
    expect(await pushesThisMonth(NOW)).toEqual({ month: "2026-10", count: 1, limit: 290 });
  });

  it("sends the 290th push and refuses the 291st without calling LINE", async () => {
    await fill(289);
    const { messenger, pushed } = recorder();

    expect(await pushWithinQuota(messenger, push(290), NOW)).toEqual({ kind: "sent" });
    expect(await pushWithinQuota(messenger, push(291), NOW)).toEqual({ kind: "refused-quota" });

    expect(pushed).toEqual([push(290)]);
    expect((await pushesThisMonth(NOW)).count).toBe(290);
  });

  it("never lets more than 290 through when many pushes start at the same moment", async () => {
    await fill(280);
    const { messenger, pushed } = recorder();

    const outcomes = await Promise.all(
      Array.from({ length: 40 }, (_, n) => pushWithinQuota(messenger, push(n), NOW)),
    );

    expect(outcomes.filter(({ kind }) => kind === "sent")).toHaveLength(10);
    expect(outcomes.filter(({ kind }) => kind === "refused-quota")).toHaveLength(30);
    expect(pushed).toHaveLength(10);
    expect((await pushesThisMonth(NOW)).count).toBe(290);
  });

  it("counts every push when the first ones of a month start at the same moment", async () => {
    const { messenger } = recorder();

    const outcomes = await Promise.all(
      Array.from({ length: 10 }, (_, n) => pushWithinQuota(messenger, push(n), NOW)),
    );

    expect(outcomes.every(({ kind }) => kind === "sent")).toBe(true);
    expect((await pushesThisMonth(NOW)).count).toBe(10);
    expect(await PushQuota.countDocuments({})).toBe(1);
  });

  it("gives the place back when the send fails", async () => {
    const { messenger } = recorder(() => ({ ok: false, error: "LINE push failed (500)" }));

    expect(await pushWithinQuota(messenger, push(1), NOW)).toEqual({
      kind: "failed",
      error: "LINE push failed (500)",
    });

    expect((await pushesThisMonth(NOW)).count).toBe(0);
  });

  it("gives the place back when the sender throws", async () => {
    const messenger: LineMessenger = {
      name: "fake",
      push: async () => {
        throw new Error("boom");
      },
      reply: async () => {
        throw new Error("Nothing here replies.");
      },
    };

    expect((await pushWithinQuota(messenger, push(1), NOW)).kind).toBe("failed");
    expect((await pushesThisMonth(NOW)).count).toBe(0);
  });

  it("lets a failed push through at the limit once it is tried again", async () => {
    await fill(289);
    let healthy = false;
    const { messenger } = recorder(() => (healthy ? { ok: true } : { ok: false, error: "down" }));

    expect((await pushWithinQuota(messenger, push(1), NOW)).kind).toBe("failed");
    healthy = true;

    expect(await pushWithinQuota(messenger, push(1), NOW)).toEqual({ kind: "sent" });
    expect((await pushesThisMonth(NOW)).count).toBe(290);
  });

  it("counts a push repeated with the same retry key once", async () => {
    const { messenger, pushed } = recorder();

    await pushWithinQuota(messenger, push(1), NOW);
    expect(await pushWithinQuota(messenger, push(1), NOW)).toEqual({ kind: "sent" });

    expect(pushed).toHaveLength(2);
    expect((await pushesThisMonth(NOW)).count).toBe(1);
  });

  it("keeps the place of an already counted push whose repeat fails", async () => {
    let healthy = true;
    const { messenger } = recorder(() => (healthy ? { ok: true } : { ok: false, error: "down" }));
    await pushWithinQuota(messenger, push(1), NOW);
    healthy = false;

    expect((await pushWithinQuota(messenger, push(1), NOW)).kind).toBe("failed");

    expect((await pushesThisMonth(NOW)).count).toBe(1);
  });

  it("starts from zero in the next Bangkok month", async () => {
    await fill(290);
    const nextMonth = new Date("2026-10-31T17:00:00Z");
    const { messenger } = recorder();

    expect((await pushWithinQuota(messenger, push(1), NOW)).kind).toBe("refused-quota");
    expect(await pushWithinQuota(messenger, push(1), nextMonth)).toEqual({ kind: "sent" });

    expect(await pushesThisMonth(nextMonth)).toEqual({ month: "2026-11", count: 1, limit: 290 });
    expect((await pushesThisMonth(NOW)).count).toBe(290);
  });
});

describe("pushesThisMonth", () => {
  it("is zero before the first push of a month", async () => {
    expect(await pushesThisMonth(NOW)).toEqual({ month: "2026-10", count: 0, limit: 290 });
  });
});
