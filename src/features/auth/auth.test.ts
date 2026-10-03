import type { GoogleProfile } from "better-auth/social-providers";
import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAuth,
  getAuth,
  isGoogleEnabled,
  RATE_LIMITS,
  resetAuthForTests,
  RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
} from "./auth";
import type { EmailMessage } from "./email";
import { cookieHeaders } from "./test-helpers";

const SECRET = "test-secret-test-secret-test-secret-1234";
const BASE_URL = "http://localhost:3000";

let server: MongoMemoryServer;
let outbox: EmailMessage[];

type NewAuthOptions = Partial<
  Pick<Parameters<typeof createAuth>[0], "adminEmails" | "google" | "sendEmail">
>;

function newAuth(options: NewAuthOptions = {}) {
  return createAuth({
    db: mongoose.connection.getClient().db(),
    secret: SECRET,
    baseURL: BASE_URL,
    sendEmail: async (message) => {
      outbox.push(message);
    },
    ...options,
  });
}

async function providerDown(): Promise<never> {
  throw new Error("provider down");
}

function tokenFrom(message: EmailMessage | undefined): string {
  if (!message) throw new Error("No email was sent");
  const token = new URL(message.url).searchParams.get("token");
  if (!token) throw new Error(`No token in ${message.url}`);
  return token;
}

function resetTokenFrom(message: EmailMessage | undefined): string {
  if (!message) throw new Error("No email was sent");
  const token = new URL(message.url).pathname.split("/").pop();
  if (!token) throw new Error(`No token in ${message.url}`);
  return token;
}

async function signUpVerified(
  auth: ReturnType<typeof newAuth>,
  credentials: { email: string; password: string },
) {
  await auth.api.signUpEmail({ body: { name: "Ada", ...credentials } });
  await auth.api.verifyEmail({ query: { token: tokenFrom(outbox[0]) } });
  outbox = [];
}

async function signInHeaders(
  auth: ReturnType<typeof newAuth>,
  credentials: { email: string; password: string },
): Promise<Headers> {
  const { headers } = await auth.api.signInEmail({ body: credentials, returnHeaders: true });
  return cookieHeaders(headers);
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
    expect(outbox[0]?.to).toBe("ada@example.com");
    expect(outbox[0]?.kind).toBe("verify-email");
  });

  it("still completes sign-up and logs when the email provider fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const auth = newAuth({ sendEmail: providerDown });

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

  it("signs the user in when the verification link is used", async () => {
    const auth = newAuth();
    await auth.api.signUpEmail({
      body: { name: "Ada", email: "ada@example.com", password: "correct horse battery" },
    });

    const { headers } = await auth.api.verifyEmail({
      query: { token: tokenFrom(outbox[0]) },
      returnHeaders: true,
    });

    const session = await auth.api.getSession({ headers: cookieHeaders(headers) });
    expect(session?.user.email).toBe("ada@example.com");
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

describe("password reset", () => {
  const credentials = { email: "ada@example.com", password: "correct horse battery" };
  const newPassword = "brand new staple secret";

  afterEach(() => {
    vi.useRealTimers();
  });

  it("sends a reset email to the account address", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);

    await auth.api.requestPasswordReset({ body: { email: credentials.email } });

    expect(outbox).toHaveLength(1);
    expect(outbox[0]?.to).toBe(credentials.email);
    expect(outbox[0]?.kind).toBe("reset-password");
  });

  it("answers an unknown email like a known one and sends nothing", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);

    const known = await auth.api.requestPasswordReset({ body: { email: credentials.email } });
    outbox = [];
    const unknown = await auth.api.requestPasswordReset({ body: { email: "nobody@example.com" } });

    expect(unknown).toEqual(known);
    expect(outbox).toHaveLength(0);
  });

  it("still answers the request and logs when the email provider fails", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    await signUpVerified(newAuth(), credentials);
    const auth = newAuth({ sendEmail: providerDown });

    const result = await auth.api.requestPasswordReset({ body: { email: credentials.email } });
    await vi.waitFor(() => expect(errors).toHaveBeenCalled());

    expect(result.status).toBe(true);
    errors.mockRestore();
  });

  it("lets the user sign in with the new password and refuses the old one", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    await auth.api.requestPasswordReset({ body: { email: credentials.email } });

    await auth.api.resetPassword({ body: { newPassword, token: resetTokenFrom(outbox[0]) } });

    const signedIn = await auth.api.signInEmail({
      body: { email: credentials.email, password: newPassword },
    });
    expect(signedIn.user.email).toBe(credentials.email);
    await expect(auth.api.signInEmail({ body: credentials })).rejects.toMatchObject({
      status: "UNAUTHORIZED",
    });
  });

  it("rejects a reset link that was already used", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    await auth.api.requestPasswordReset({ body: { email: credentials.email } });
    const token = resetTokenFrom(outbox[0]);
    await auth.api.resetPassword({ body: { newPassword, token } });

    await expect(
      auth.api.resetPassword({ body: { newPassword: "attacker chosen secret", token } }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });

    await expect(
      auth.api.signInEmail({ body: { email: credentials.email, password: newPassword } }),
    ).resolves.toBeTruthy();
  });

  it("rejects an unknown token", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);

    await expect(
      auth.api.resetPassword({ body: { newPassword, token: "not-a-real-token" } }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });
  });

  it("rejects an expired token and keeps the old password", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    await auth.api.requestPasswordReset({ body: { email: credentials.email } });
    const token = resetTokenFrom(outbox[0]);

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + (RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS + 60) * 1000);

    await expect(auth.api.resetPassword({ body: { newPassword, token } })).rejects.toMatchObject({
      status: "BAD_REQUEST",
    });
    await expect(auth.api.signInEmail({ body: credentials })).resolves.toBeTruthy();
  });

  async function followResetLink(
    auth: ReturnType<typeof newAuth>,
    message: EmailMessage | undefined,
  ) {
    if (!message) throw new Error("No email was sent");
    const response = await auth.handler(new Request(message.url));
    return new URL(response.headers.get("location") ?? "", BASE_URL);
  }

  it("forwards a fresh emailed link to the reset screen with its token", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    await auth.api.requestPasswordReset({
      body: { email: credentials.email, redirectTo: "/reset-password" },
    });

    const target = await followResetLink(auth, outbox[0]);

    expect(target.pathname).toBe("/reset-password");
    expect(target.searchParams.get("token")).toBe(resetTokenFrom(outbox[0]));
    expect(target.searchParams.get("error")).toBeNull();
  });

  it("forwards an already-used emailed link to the reset screen with an error", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    await auth.api.requestPasswordReset({
      body: { email: credentials.email, redirectTo: "/reset-password" },
    });
    await auth.api.resetPassword({ body: { newPassword, token: resetTokenFrom(outbox[0]) } });

    const target = await followResetLink(auth, outbox[0]);

    expect(target.pathname).toBe("/reset-password");
    expect(target.searchParams.get("error")).toBe("INVALID_TOKEN");
    expect(target.searchParams.get("token")).toBeNull();
  });

  it("signs out existing sessions after a reset", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    const sessionHeaders = await signInHeaders(auth, credentials);
    expect(await auth.api.getSession({ headers: sessionHeaders })).not.toBeNull();

    await auth.api.requestPasswordReset({ body: { email: credentials.email } });
    await auth.api.resetPassword({ body: { newPassword, token: resetTokenFrom(outbox[0]) } });

    expect(await auth.api.getSession({ headers: sessionHeaders })).toBeNull();
  });
});

describe("remember me", () => {
  const credentials = { email: "ada@example.com", password: "correct horse battery" };

  async function sessionCookie(body: typeof credentials & { rememberMe?: boolean }) {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    const { headers } = await auth.api.signInEmail({ body, returnHeaders: true });
    const cookie = headers.getSetCookie().find((value) => value.includes("session_token="));
    if (!cookie) throw new Error("No session cookie was set");
    return cookie;
  }

  it.each([
    ["by default", credentials],
    ["when remembered", { ...credentials, rememberMe: true }],
  ])("gives a session cookie that outlives the browser session %s", async (_case, body) => {
    expect(await sessionCookie(body)).toMatch(/max-age=\d+/i);
  });

  it("gives a cookie that ends with the browser session when not remembered", async () => {
    expect(await sessionCookie({ ...credentials, rememberMe: false })).not.toMatch(/max-age/i);
  });
});

describe("roles", () => {
  const password = "correct horse battery";

  async function roleOf(auth: ReturnType<typeof newAuth>, email: string) {
    await signUpVerified(auth, { email, password });
    const headers = await signInHeaders(auth, { email, password });
    const session = await auth.api.getSession({ headers });
    return session?.user.role;
  }

  it("makes an allow-listed email an admin", async () => {
    const auth = newAuth({ adminEmails: "owner@example.com" });

    expect(await roleOf(auth, "owner@example.com")).toBe("admin");
  });

  it("makes everyone else a regular user", async () => {
    const auth = newAuth({ adminEmails: "owner@example.com" });

    expect(await roleOf(auth, "ada@example.com")).toBe("user");
  });

  it("makes everyone a regular user when no allow-list is configured", async () => {
    expect(await roleOf(newAuth(), "ada@example.com")).toBe("user");
    expect(await roleOf(newAuth({ adminEmails: " , " }), "bob@example.com")).toBe("user");
  });

  it("matches the allow-list ignoring case and surrounding whitespace", async () => {
    const auth = newAuth({ adminEmails: "first@example.com ,  Owner@Example.COM " });

    expect(await roleOf(auth, "owner@example.com")).toBe("admin");
  });

  it("does not promote an existing user when the allow-list changes later", async () => {
    await roleOf(newAuth(), "ada@example.com");

    const auth = newAuth({ adminEmails: "ada@example.com" });
    const headers = await signInHeaders(auth, { email: "ada@example.com", password });
    const session = await auth.api.getSession({ headers });

    expect(session?.user.role).toBe("user");
  });

  it("ignores a role that a raw HTTP request supplies at sign-up", async () => {
    const auth = newAuth();
    const credentials = { email: "mallory@example.com", password };

    const response = await auth.handler(
      new Request(`${BASE_URL}/api/auth/sign-up/email`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL },
        body: JSON.stringify({ name: "Mallory", ...credentials, role: "admin" }),
      }),
    );
    expect(response.status).toBe(200);
    await auth.api.verifyEmail({ query: { token: tokenFrom(outbox[0]) } });

    const headers = await signInHeaders(auth, credentials);
    const session = await auth.api.getSession({ headers });
    expect(session?.user.role).toBe("user");
  });
});

describe("role changes", () => {
  it("refuses a signed-in user changing their own role", async () => {
    const auth = newAuth();
    const credentials = { email: "ada@example.com", password: "correct horse battery" };
    await signUpVerified(auth, credentials);
    const headers = await signInHeaders(auth, credentials);

    await expect(
      // @ts-expect-error role is not part of the update input; a raw HTTP client can still send it.
      auth.api.updateUser({ headers, body: { role: "admin" } }),
    ).rejects.toMatchObject({ status: "BAD_REQUEST" });

    const session = await auth.api.getSession({ headers });
    expect(session?.user.role).toBe("user");
  });
});

describe("rate limiting", () => {
  const credentials = { email: "ada@example.com", password: "correct horse battery" };

  function post(auth: ReturnType<typeof newAuth>, path: string, body: unknown, ip = "203.0.113.7") {
    return auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method: "POST",
        headers: { "content-type": "application/json", origin: BASE_URL, "x-forwarded-for": ip },
        body: JSON.stringify(body),
      }),
    );
  }

  async function statuses(count: number, send: () => Promise<Response>) {
    const result: number[] = [];
    for (let i = 0; i < count; i++) result.push((await send()).status);
    return result;
  }

  it("allows email sign-in up to the limit and refuses the next attempt", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    const { max } = RATE_LIMITS.signInEmail;

    const allowed = await statuses(max, () => post(auth, "/sign-in/email", credentials));
    const refused = await post(auth, "/sign-in/email", credentials);

    expect(allowed).toEqual(Array(max).fill(200));
    expect(refused.status).toBe(429);
  });

  it("counts failed sign-in attempts too", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    const { max } = RATE_LIMITS.signInEmail;
    const wrong = { ...credentials, password: "not the password" };

    const allowed = await statuses(max, () => post(auth, "/sign-in/email", wrong));
    const refused = await post(auth, "/sign-in/email", credentials);

    expect(allowed).toEqual(Array(max).fill(401));
    expect(refused.status).toBe(429);
  });

  it("refuses password-reset requests beyond the limit and sends no further email", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    const { max } = RATE_LIMITS.requestPasswordReset;
    const body = { email: credentials.email, redirectTo: "/reset-password" };

    const allowed = await statuses(max, () => post(auth, "/request-password-reset", body));
    const refused = await post(auth, "/request-password-reset", body);

    expect(allowed).toEqual(Array(max).fill(200));
    expect(refused.status).toBe(429);
    expect(outbox).toHaveLength(max);
  });

  it("limits each client address separately", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    await statuses(RATE_LIMITS.signInEmail.max + 1, () =>
      post(auth, "/sign-in/email", credentials, "203.0.113.7"),
    );

    const otherClient = await post(auth, "/sign-in/email", credentials, "198.51.100.9");

    expect(otherClient.status).toBe(200);
  });

  it("keeps the counters in the database", async () => {
    const auth = newAuth();
    await signUpVerified(auth, credentials);
    const { max } = RATE_LIMITS.signInEmail;

    await statuses(max, () => post(auth, "/sign-in/email", credentials));

    const rows = await mongoose.connection
      .getClient()
      .db()
      .collection("rateLimit")
      .find()
      .toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.count).toBe(max);
  });

  it("gives the rest of the auth API a looser limit than sign-in", async () => {
    const auth = newAuth();
    const beyondSignInLimit = RATE_LIMITS.signInEmail.max + 1;

    const result = await statuses(beyondSignInLimit, () =>
      auth.handler(
        new Request(`${BASE_URL}/api/auth/get-session`, {
          headers: { "x-forwarded-for": "203.0.113.7" },
        }),
      ),
    );

    expect(result).toEqual(Array(beyondSignInLimit).fill(200));
  });
});

describe("Google sign-in", () => {
  const google = { clientId: "test-client-id", clientSecret: "test-client-secret" };
  const password = "correct horse battery";

  function authWithGoogleProfile(
    profile: { email: string; emailVerified: boolean },
    options: NewAuthOptions = {},
  ) {
    return newAuth({
      ...options,
      google: {
        ...google,
        verifyIdToken: async () => true,
        getUserInfo: async () => ({
          user: { name: "Ada", ...profile },
          data: {
            sub: `google-${profile.email}`,
            name: "Ada",
            email: profile.email,
            email_verified: profile.emailVerified,
          } as GoogleProfile,
        }),
      },
    });
  }

  async function signInWithGoogle(auth: ReturnType<typeof newAuth>) {
    const { headers } = await auth.api.signInSocial({
      body: { provider: "google", idToken: { token: "fake-id-token" } },
      returnHeaders: true,
    });
    return auth.api.getSession({ headers: cookieHeaders(headers) });
  }

  it("signs in a new visitor whose Google email is verified as a regular user", async () => {
    const auth = authWithGoogleProfile({ email: "ada@example.com", emailVerified: true });

    const session = await signInWithGoogle(auth);

    expect(session?.user.email).toBe("ada@example.com");
    expect(session?.user.role).toBe("user");
  });

  it("makes an allow-listed Google email an admin", async () => {
    const auth = authWithGoogleProfile(
      { email: "owner@example.com", emailVerified: true },
      { adminEmails: "owner@example.com" },
    );

    const session = await signInWithGoogle(auth);

    expect(session?.user.role).toBe("admin");
  });

  it("gives no session when Google reports the email as unverified, even if allow-listed", async () => {
    const auth = authWithGoogleProfile(
      { email: "owner@example.com", emailVerified: false },
      { adminEmails: "owner@example.com" },
    );

    const session = await signInWithGoogle(auth).catch(() => null);

    expect(session).toBeNull();
    expect(outbox.map((message) => message.to)).toEqual(["owner@example.com"]);
  });

  it("signs in to the existing account when its email is already verified", async () => {
    const auth = authWithGoogleProfile({ email: "ada@example.com", emailVerified: true });
    await signUpVerified(auth, { email: "ada@example.com", password });
    const existing = await auth.api.signInEmail({ body: { email: "ada@example.com", password } });

    const session = await signInWithGoogle(auth);

    expect(session?.user.id).toBe(existing.user.id);
  });

  it("refuses Google sign-in for an address someone registered but never verified", async () => {
    const auth = authWithGoogleProfile({ email: "ada@example.com", emailVerified: true });
    await auth.api.signUpEmail({ body: { name: "Mallory", email: "ada@example.com", password } });

    const session = await signInWithGoogle(auth).catch(() => null);

    expect(session).toBeNull();
  });

  it("is refused when no Google credentials are configured", async () => {
    const auth = newAuth();

    await expect(auth.api.signInSocial({ body: { provider: "google" } })).rejects.toMatchObject({
      status: "NOT_FOUND",
    });
  });

  it("sends the visitor to Google with the app's callback when credentials are configured", async () => {
    const auth = newAuth({ google });

    const result = await auth.api.signInSocial({ body: { provider: "google" } });

    const target = new URL(result.url ?? "");
    expect(target.hostname).toBe("accounts.google.com");
    expect(target.searchParams.get("client_id")).toBe(google.clientId);
    expect(target.searchParams.get("redirect_uri")).toBe(`${BASE_URL}/api/auth/callback/google`);
    expect(target.href).not.toContain(google.clientSecret);
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

  describe("Google credentials from the environment", () => {
    beforeEach(() => {
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
    });

    async function googleOffered() {
      const auth = await getAuth();
      return auth.api.signInSocial({ body: { provider: "google" } }).then(
        () => true,
        () => false,
      );
    }

    it("leaves Google off when neither variable is set", async () => {
      expect(isGoogleEnabled()).toBe(false);
      expect(await googleOffered()).toBe(false);
    });

    it("leaves Google off when only one of the two variables is set", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";

      expect(isGoogleEnabled()).toBe(false);
      expect(await googleOffered()).toBe(false);
    });

    it("turns Google on when both variables are set", async () => {
      process.env.GOOGLE_CLIENT_ID = "test-client-id";
      process.env.GOOGLE_CLIENT_SECRET = "test-client-secret";

      expect(isGoogleEnabled()).toBe(true);
      expect(await googleOffered()).toBe(true);
    });
  });

  it("builds once and reuses the instance", async () => {
    const first = await getAuth();
    const second = await getAuth();
    expect(second).toBe(first);
  });
});
