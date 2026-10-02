import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuth, getAuth, resetAuthForTests } from "./auth";
import type { EmailMessage } from "./email";

const SECRET = "test-secret-test-secret-test-secret-1234";
const BASE_URL = "http://localhost:3000";

let server: MongoMemoryServer;
let outbox: EmailMessage[];

function newAuth() {
  return createAuth({
    db: mongoose.connection.getClient().db(),
    secret: SECRET,
    baseURL: BASE_URL,
    sendEmail: async (message) => {
      outbox.push(message);
    },
  });
}

function tokenFrom(message: EmailMessage): string {
  const token = new URL(message.url).searchParams.get("token");
  if (!token) throw new Error(`No token in ${message.url}`);
  return token;
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  await mongoose.connect(server.getUri("auth-test"));
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(async () => {
  outbox = [];
  await mongoose.connection.dropDatabase();
});

describe("email sign-up", () => {
  it("sends a verification email to the new address", async () => {
    const auth = newAuth();

    await auth.api.signUpEmail({
      body: { name: "Ada", email: "ada@example.com", password: "correct horse battery" },
    });

    expect(outbox).toHaveLength(1);
    expect(outbox[0].to).toBe("ada@example.com");
    expect(outbox[0].kind).toBe("verify-email");
  });

  it("still completes sign-up and logs when the email provider fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = createAuth({
      db: mongoose.connection.getClient().db(),
      secret: SECRET,
      baseURL: BASE_URL,
      sendEmail: async () => {
        throw new Error("provider down");
      },
    });

    const result = await auth.api.signUpEmail({
      body: { name: "Ada", email: "ada@example.com", password: "correct horse battery" },
    });
    await vi.waitFor(() => expect(errors).toHaveBeenCalled());

    expect(result.user.email).toBe("ada@example.com");
    errors.mockRestore();
  });

  it("refuses sign-in until the address is verified, then allows it", async () => {
    const auth = newAuth();
    const credentials = { email: "ada@example.com", password: "correct horse battery" };
    await auth.api.signUpEmail({ body: { name: "Ada", ...credentials } });

    await expect(auth.api.signInEmail({ body: credentials })).rejects.toMatchObject({
      status: "FORBIDDEN",
    });

    await auth.api.verifyEmail({ query: { token: tokenFrom(outbox[0]) } });

    const result = await auth.api.signInEmail({ body: credentials });
    expect(result.user.email).toBe("ada@example.com");
    expect(result.token).toBeTruthy();
  });

  it("answers a duplicate sign-up like a fresh one and does not change the password", async () => {
    const auth = newAuth();
    const original = { email: "ada@example.com", password: "correct horse battery" };
    await auth.api.signUpEmail({ body: { name: "Ada", ...original } });
    await auth.api.verifyEmail({ query: { token: tokenFrom(outbox[0]) } });

    const again = await auth.api.signUpEmail({
      body: { name: "Mallory", email: original.email, password: "attacker chosen secret" },
    });

    expect(again.user.email).toBe(original.email);
    await expect(
      auth.api.signInEmail({ body: { email: original.email, password: "attacker chosen secret" } }),
    ).rejects.toBeTruthy();
    const signedIn = await auth.api.signInEmail({ body: original });
    expect(signedIn.user.name).toBe("Ada");
  });
});

describe("getAuth", () => {
  const saved = { ...process.env };

  beforeEach(() => {
    resetAuthForTests();
    process.env.MONGODB_URI = server.getUri("auth-test");
    process.env.BETTER_AUTH_SECRET = SECRET;
    process.env.BETTER_AUTH_URL = BASE_URL;
  });

  afterAll(() => {
    process.env = { ...saved };
  });

  it("throws a helpful error when BETTER_AUTH_SECRET is missing", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    await expect(getAuth()).rejects.toThrow(/BETTER_AUTH_SECRET/);
  });

  it("throws a helpful error when BETTER_AUTH_URL is missing", async () => {
    delete process.env.BETTER_AUTH_URL;
    await expect(getAuth()).rejects.toThrow(/BETTER_AUTH_URL/);
  });

  it("recovers once the missing variable is fixed", async () => {
    delete process.env.BETTER_AUTH_SECRET;
    await expect(getAuth()).rejects.toThrow(/BETTER_AUTH_SECRET/);

    process.env.BETTER_AUTH_SECRET = SECRET;
    await expect(getAuth()).resolves.toBeDefined();
  });

  it("builds once and reuses the instance", async () => {
    const first = await getAuth();
    const second = await getAuth();
    expect(second).toBe(first);
  });
});
