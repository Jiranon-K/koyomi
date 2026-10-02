import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import { getAuth, resetAuthForTests } from "./auth";
import type { EmailMessage } from "./email";
import { requireAdmin, requireSession } from "./session";

// The request and navigation APIs only exist inside a Next.js request, so they are replaced here.
// Everything else is real: the auth instance, its cookies and the database.
const mocks = vi.hoisted(() => ({
  requestHeaders: new Headers(),
  outbox: [] as EmailMessage[],
}));

vi.mock("next/headers", () => ({
  headers: async () => mocks.requestHeaders,
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`REDIRECT ${path}`);
  },
  notFound: () => {
    throw new Error("NOT_FOUND");
  },
}));

vi.mock("./email", () => ({
  sendEmail: async (message: EmailMessage) => {
    mocks.outbox.push(message);
  },
}));

const password = "correct horse battery";
const saved = { ...process.env };

let server: MongoMemoryServer;

// Signs the address up, verifies it, signs in and makes the session cookie the current request's.
async function signInAs(email: string) {
  const auth = await getAuth();
  await auth.api.signUpEmail({ body: { name: "Ada", email, password } });
  const token = new URL(mocks.outbox[mocks.outbox.length - 1].url).searchParams.get("token");
  await auth.api.verifyEmail({ query: { token: token ?? "" } });
  const { headers } = await auth.api.signInEmail({
    body: { email, password },
    returnHeaders: true,
  });
  const cookie = headers
    .getSetCookie()
    .map((value) => value.split(";")[0])
    .join("; ");
  mocks.requestHeaders = new Headers({ cookie });
}

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("session-test");
  process.env.BETTER_AUTH_SECRET = "test-secret-test-secret-test-secret-1234";
  process.env.BETTER_AUTH_URL = "http://localhost:3000";
  process.env.ADMIN_EMAILS = "owner@example.com";
});

afterAll(async () => {
  process.env = { ...saved };
  resetAuthForTests();
  await mongoose.disconnect();
  await server.stop();
});

beforeEach(() => {
  mocks.requestHeaders = new Headers();
  mocks.outbox.length = 0;
});

describe("requireSession", () => {
  it("redirects an anonymous request to sign-in", async () => {
    await expect(requireSession()).rejects.toThrow("REDIRECT /sign-in");
  });

  it("redirects a request whose session cookie is forged", async () => {
    mocks.requestHeaders = new Headers({ cookie: "better-auth.session_token=forged.forged" });

    await expect(requireSession()).rejects.toThrow("REDIRECT /sign-in");
  });

  it("returns the session of a signed-in user", async () => {
    await signInAs("ada@example.com");

    const session = await requireSession();

    expect(session.user.email).toBe("ada@example.com");
    expect(session.user.emailVerified).toBe(true);
    expect(session.user.role).toBe("user");
  });
});

describe("requireAdmin", () => {
  it("redirects an anonymous request to sign-in", async () => {
    await expect(requireAdmin()).rejects.toThrow("REDIRECT /sign-in");
  });

  it("rejects a signed-in regular user", async () => {
    await signInAs("bob@example.com");

    await expect(requireAdmin()).rejects.toThrow("NOT_FOUND");
  });

  it("returns the session of an admin", async () => {
    await signInAs("owner@example.com");

    const session = await requireAdmin();

    expect(session.user.email).toBe("owner@example.com");
    expect(session.user.role).toBe("admin");
  });
});
