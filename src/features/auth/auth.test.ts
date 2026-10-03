import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  createAuth,
  getAuth,
  isLineLoginEnabled,
  RATE_LIMITS,
  resetAuthForTests,
  RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
} from "./auth";
import type { EmailMessage } from "./email";
import { disconnectLine, lineConnectUrl } from "./line-account";
import { cookieHeaders } from "./test-helpers";

const SECRET = "test-secret-test-secret-test-secret-1234";
const BASE_URL = "http://localhost:3000";

let server: MongoMemoryServer;
let outbox: EmailMessage[];

type NewAuthOptions = Partial<
  Pick<
    Parameters<typeof createAuth>[0],
    "adminEmails" | "line" | "onLineAccount" | "onLineAccountRemoved" | "sendEmail"
  >
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

describe("LINE sign-in", () => {
  const line = { clientId: "test-channel-id", clientSecret: "test-channel-secret" };
  const password = "correct horse battery";
  const TOKEN_ENDPOINT = "https://api.line.me/oauth2/v2.1/token";

  type LineIdentity = { sub: string; email?: string };
  type LineAccountEvent = Parameters<NonNullable<NewAuthOptions["onLineAccount"]>>[0];

  function lineAnswersAs(identity: LineIdentity) {
    const encode = (value: object) => Buffer.from(JSON.stringify(value)).toString("base64url");
    const idToken = [
      encode({ alg: "HS256", typ: "JWT" }),
      encode({ iss: "https://access.line.me", aud: line.clientId, name: "Ada", ...identity }),
      "signature",
    ].join(".");
    vi.stubGlobal("fetch", async (input: RequestInfo | URL) => {
      const url = input instanceof Request ? input.url : String(input);
      if (url !== TOKEN_ENDPOINT) throw new Error(`Unexpected request to ${url}`);
      return Response.json({
        access_token: `access-token-of-${identity.sub}`,
        token_type: "Bearer",
        expires_in: 3600,
        scope: "openid profile",
        id_token: idToken,
      });
    });
  }

  function post(auth: ReturnType<typeof newAuth>, path: string, body: unknown, cookies?: Headers) {
    return auth.handler(
      new Request(`${BASE_URL}/api/auth${path}`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          origin: BASE_URL,
          cookie: cookies?.get("cookie") ?? "",
        },
        body: JSON.stringify(body),
      }),
    );
  }

  async function returnFromLine(auth: ReturnType<typeof newAuth>, started: Response, cookies = "") {
    const { url } = (await started.json()) as { url: string };
    const state = new URL(url).searchParams.get("state") ?? "";
    const cookie = [cookies, cookieHeaders(started.headers).get("cookie")]
      .filter(Boolean)
      .join("; ");
    const finished = await auth.handler(
      new Request(`${BASE_URL}/api/auth/callback/line?code=fake-code&state=${state}`, {
        headers: { cookie },
      }),
    );
    const signedIn = cookieHeaders(finished.headers);
    return {
      target: new URL(finished.headers.get("location") ?? "", BASE_URL),
      cookies: signedIn,
      session: await auth.api.getSession({ headers: signedIn }),
    };
  }

  async function signInWithLine(auth: ReturnType<typeof newAuth>) {
    const started = await post(auth, "/sign-in/social", {
      provider: "line",
      callbackURL: "/dashboard",
      errorCallbackURL: "/sign-in",
    });
    return returnFromLine(auth, started);
  }

  async function connectLine(auth: ReturnType<typeof newAuth>, session: Headers) {
    const started = await post(
      auth,
      "/link-social",
      { provider: "line", callbackURL: "/settings", errorCallbackURL: "/settings" },
      session,
    );
    return returnFromLine(auth, started, session.get("cookie") ?? "");
  }

  async function signedInEmailUser(auth: ReturnType<typeof newAuth>, email: string) {
    await signUpVerified(auth, { email, password });
    const headers = await signInHeaders(auth, { email, password });
    const session = await auth.api.getSession({ headers });
    if (!session) throw new Error("No session after sign-in");
    return { headers, userId: session.user.id };
  }

  function users() {
    return mongoose.connection.getClient().db().collection("user").find().toArray();
  }

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("gives no session for a LINE-supplied email until that address is verified", async () => {
    const auth = newAuth({ line });
    lineAnswersAs({ sub: "U-ada", email: "ada@example.com" });

    const first = await signInWithLine(auth);

    expect(first.session).toBeNull();
    expect(first.target.pathname).toBe("/sign-in");
    expect(first.target.searchParams.get("error")).toBe("email_not_verified");
    expect(outbox.map((message) => [message.to, message.kind])).toEqual([
      ["ada@example.com", "verify-email"],
    ]);

    await auth.api.verifyEmail({ query: { token: tokenFrom(outbox[0]) } });
    const second = await signInWithLine(auth);

    expect(second.target.pathname).toBe("/dashboard");
    expect(second.session?.user.email).toBe("ada@example.com");
    expect(second.session?.user.role).toBe("user");
  });

  it("reports a LINE sign-up to the app only once its email is verified", async () => {
    const linked: LineAccountEvent[] = [];
    const auth = newAuth({
      line,
      onLineAccount: async (event) => {
        linked.push(event);
      },
    });
    lineAnswersAs({ sub: "U-ada", email: "ada@example.com" });

    await signInWithLine(auth);
    await signInWithLine(auth);

    expect(linked).toEqual([]);

    await auth.api.verifyEmail({ query: { token: tokenFrom(outbox[0]) } });

    const [user] = await users();
    expect(linked).toEqual([
      { userId: String(user?._id), lineUserId: "U-ada", accessToken: "access-token-of-U-ada" },
    ]);
  });

  it("gives no session for an allow-listed LINE email that was never verified", async () => {
    const auth = newAuth({ line, adminEmails: "owner@example.com" });
    lineAnswersAs({ sub: "U-mallory", email: "owner@example.com" });

    const { session, target } = await signInWithLine(auth);
    const again = await signInWithLine(auth);

    expect(session).toBeNull();
    expect(again.session).toBeNull();
    expect(target.searchParams.get("error")).toBe("email_not_verified");
    expect((await users()).map((user) => user.emailVerified)).toEqual([false]);
  });

  it("does not sign in to, or link to, an existing verified account with the same email", async () => {
    const auth = newAuth({ line, adminEmails: "owner@example.com" });
    const owner = await signedInEmailUser(auth, "owner@example.com");
    lineAnswersAs({ sub: "U-mallory", email: "owner@example.com" });

    const { session, target } = await signInWithLine(auth);

    expect(session).toBeNull();
    expect(target.searchParams.get("error")).toBe("account_not_linked");
    const accounts = await auth.api.listUserAccounts({ headers: owner.headers });
    expect(accounts.map((account) => account.providerId)).toEqual(["credential"]);
  });

  it("does not sign in to an address someone registered but never verified", async () => {
    const auth = newAuth({ line });
    await auth.api.signUpEmail({ body: { name: "Mallory", email: "ada@example.com", password } });
    lineAnswersAs({ sub: "U-ada", email: "ada@example.com" });

    const { session, target } = await signInWithLine(auth);

    expect(session).toBeNull();
    expect(target.searchParams.get("error")).toBe("account_not_linked");
  });

  it("creates no account and no session when LINE shares no email", async () => {
    const auth = newAuth({ line });
    lineAnswersAs({ sub: "U-ada" });

    const { session, target } = await signInWithLine(auth);

    expect(session).toBeNull();
    expect(target.pathname).toBe("/sign-in");
    expect(target.searchParams.get("error")).toBe("email_not_found");
    expect(await users()).toEqual([]);
  });

  it("refuses an ID token handed over by the browser", async () => {
    const auth = newAuth({ line });
    lineAnswersAs({ sub: "U-ada", email: "ada@example.com" });

    await expect(
      auth.api.signInSocial({ body: { provider: "line", idToken: { token: "forged" } } }),
    ).rejects.toMatchObject({ status: "NOT_FOUND" });
    expect(await users()).toEqual([]);
  });

  it("is refused when no LINE credentials are configured", async () => {
    const auth = newAuth();

    await expect(auth.api.signInSocial({ body: { provider: "line" } })).rejects.toMatchObject({
      status: "NOT_FOUND",
    });
  });

  it("sends the visitor to LINE with the app's callback and the add-friend prompt", async () => {
    const auth = newAuth({ line });

    const result = await auth.api.signInSocial({
      body: { provider: "line", additionalParams: { bot_prompt: "normal" } },
    });

    const target = new URL(result.url ?? "");
    expect(target.hostname).toBe("access.line.me");
    expect(target.searchParams.get("client_id")).toBe(line.clientId);
    expect(target.searchParams.get("redirect_uri")).toBe(`${BASE_URL}/api/auth/callback/line`);
    expect(target.searchParams.get("bot_prompt")).toBe("normal");
    expect(target.href).not.toContain(line.clientSecret);
  });

  describe("connecting LINE to a signed-in account", () => {
    it("links the LINE account whatever email LINE reports, and reports the link", async () => {
      const linked: LineAccountEvent[] = [];
      const auth = newAuth({
        line,
        onLineAccount: async (event) => {
          linked.push(event);
        },
      });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-ada", email: "someone-else@example.com" });

      const { target } = await connectLine(auth, ada.headers);

      expect(target.pathname).toBe("/settings");
      expect(target.searchParams.get("error")).toBeNull();
      expect(linked).toEqual([
        { userId: ada.userId, lineUserId: "U-ada", accessToken: "access-token-of-U-ada" },
      ]);
      const session = await auth.api.getSession({ headers: ada.headers });
      expect(session?.user.email).toBe("ada@example.com");
    });

    it("links a LINE account that shares no email", async () => {
      const auth = newAuth({ line });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-ada" });

      const { target } = await connectLine(auth, ada.headers);

      expect(target.searchParams.get("error")).toBeNull();
      const accounts = await auth.api.listUserAccounts({ headers: ada.headers });
      expect(accounts.map((account) => account.providerId).sort()).toEqual(["credential", "line"]);
    });

    it("then signs that user in with LINE, and reports the account again", async () => {
      const linked: LineAccountEvent[] = [];
      const auth = newAuth({
        line,
        onLineAccount: async (event) => {
          linked.push(event);
        },
      });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-ada" });
      await connectLine(auth, ada.headers);

      const { session } = await signInWithLine(auth);

      expect(session?.user.id).toBe(ada.userId);
      expect(linked).toHaveLength(2);
      expect(linked[1]).toMatchObject({ userId: ada.userId, lineUserId: "U-ada" });
    });

    it("keeps the link when the link listener fails", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const auth = newAuth({ line, onLineAccount: providerDown });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-ada" });

      const { target } = await connectLine(auth, ada.headers);

      expect(target.searchParams.get("error")).toBeNull();
      expect(errors).toHaveBeenCalled();
      errors.mockRestore();
    });

    it("refuses a LINE account that already belongs to another user", async () => {
      const auth = newAuth({ line });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-shared" });
      await connectLine(auth, ada.headers);
      outbox = [];
      const bob = await signedInEmailUser(auth, "bob@example.com");

      const { target } = await connectLine(auth, bob.headers);

      expect(target.pathname).toBe("/settings");
      expect(target.searchParams.get("error")).toBe("account_already_linked_to_different_user");
      const accounts = await auth.api.listUserAccounts({ headers: bob.headers });
      expect(accounts.map((account) => account.providerId)).toEqual(["credential"]);
    });

    it("refuses to connect without a session", async () => {
      const auth = newAuth({ line });

      const response = await post(auth, "/link-social", { provider: "line" });

      expect(response.status).toBe(401);
    });

    it("builds the connect address with the app's callback and the add-friend screen", async () => {
      const auth = newAuth({ line });
      const ada = await signedInEmailUser(auth, "ada@example.com");

      const target = new URL(await lineConnectUrl(auth, ada.headers));

      expect(target.hostname).toBe("access.line.me");
      expect(target.searchParams.get("bot_prompt")).toBe("aggressive");
      expect(target.searchParams.get("redirect_uri")).toBe(`${BASE_URL}/api/auth/callback/line`);
      expect(target.href).not.toContain(line.clientSecret);
    });

    it("stops signing the user in with LINE once it is disconnected", async () => {
      const auth = newAuth({ line });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-ada" });
      await connectLine(auth, ada.headers);

      expect(await disconnectLine(auth, ada.headers)).toEqual({ kind: "ok" });
      const { session, target } = await signInWithLine(auth);

      expect(session).toBeNull();
      expect(target.searchParams.get("error")).toBe("email_not_found");
      const accounts = await auth.api.listUserAccounts({ headers: ada.headers });
      expect(accounts.map((account) => account.providerId)).toEqual(["credential"]);
    });

    it("reports the LINE account it removed", async () => {
      const removed: { userId: string; lineUserId: string }[] = [];
      const auth = newAuth({
        line,
        onLineAccountRemoved: async (account) => {
          removed.push(account);
        },
      });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-ada" });
      await connectLine(auth, ada.headers);

      expect(await disconnectLine(auth, ada.headers)).toEqual({ kind: "ok" });

      expect(removed).toEqual([{ userId: expect.any(String), lineUserId: "U-ada" }]);
    });

    it("treats disconnecting when nothing is connected as done", async () => {
      const auth = newAuth({ line });
      const ada = await signedInEmailUser(auth, "ada@example.com");

      expect(await disconnectLine(auth, ada.headers)).toEqual({ kind: "ok" });
    });

    it("refuses to disconnect LINE when it is the only way to sign in", async () => {
      const auth = newAuth({ line });
      lineAnswersAs({ sub: "U-ada", email: "ada@example.com" });
      await signInWithLine(auth);
      await auth.api.verifyEmail({ query: { token: tokenFrom(outbox[0]) } });
      const { session, cookies } = await signInWithLine(auth);

      expect(session?.user.email).toBe("ada@example.com");
      expect(await disconnectLine(auth, cookies)).toEqual({ kind: "only-sign-in-method" });
      expect((await signInWithLine(auth)).session).not.toBeNull();
    });

    it("refuses to disconnect LINE from a session that is more than a day old", async () => {
      const auth = newAuth({ line });
      const ada = await signedInEmailUser(auth, "ada@example.com");
      lineAnswersAs({ sub: "U-ada" });
      await connectLine(auth, ada.headers);

      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(Date.now() + 25 * 60 * 60 * 1000);
      const outcome = await disconnectLine(auth, ada.headers);
      vi.useRealTimers();

      expect(outcome).toEqual({ kind: "stale-session" });
    });

    it("refuses to disconnect without a session", async () => {
      const errors = vi.spyOn(console, "error").mockImplementation(() => {});
      const auth = newAuth({ line });

      expect(await disconnectLine(auth, new Headers())).toEqual({ kind: "error" });
      errors.mockRestore();
    });
  });

  it("never creates an account for the stand-in address of a LINE user without email", async () => {
    const auth = newAuth({ line });

    await expect(
      auth.api.signUpEmail({
        body: { name: "Mallory", email: "line-user-u-ada@no-email.invalid", password },
      }),
    ).rejects.toBeTruthy();
    expect(await users()).toEqual([]);
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

  describe("LINE credentials from the environment", () => {
    beforeEach(() => {
      delete process.env.LINE_LOGIN_CHANNEL_ID;
      delete process.env.LINE_LOGIN_CHANNEL_SECRET;
    });

    async function lineOffered() {
      const auth = await getAuth();
      return auth.api.signInSocial({ body: { provider: "line" } }).then(
        () => true,
        () => false,
      );
    }

    it("leaves LINE off when neither variable is set", async () => {
      expect(isLineLoginEnabled()).toBe(false);
      expect(await lineOffered()).toBe(false);
    });

    it("leaves LINE off when only one of the two variables is set", async () => {
      const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
      process.env.LINE_LOGIN_CHANNEL_ID = "test-channel-id";

      expect(isLineLoginEnabled()).toBe(false);
      expect(await lineOffered()).toBe(false);
      warn.mockRestore();
    });

    it("turns LINE on when both variables are set", async () => {
      process.env.LINE_LOGIN_CHANNEL_ID = "test-channel-id";
      process.env.LINE_LOGIN_CHANNEL_SECRET = "test-channel-secret";

      expect(isLineLoginEnabled()).toBe(true);
      expect(await lineOffered()).toBe(true);
    });
  });

  it("builds once and reuses the instance", async () => {
    const first = await getAuth();
    const second = await getAuth();
    expect(second).toBe(first);
  });
});
