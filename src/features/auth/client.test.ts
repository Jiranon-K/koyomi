import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createAuthActions, type AuthTransport } from "./client";
import { readPendingEmail } from "./pending-email";

type Reply = Awaited<ReturnType<AuthTransport["signOut"]>>;
type Actions = ReturnType<typeof createAuthActions>;

const succeeded: Reply = { error: null };

function failedWith(status: number, code?: string): Reply {
  return { error: code ? { status, code } : { status } };
}

function actionsReplying(reply: Reply | Error) {
  const method = () =>
    vi.fn(async (input?: unknown) => {
      void input;
      if (reply instanceof Error) throw reply;
      return reply;
    });
  const client = {
    signIn: { email: method(), social: method() },
    signUp: { email: method() },
    signOut: method(),
    requestPasswordReset: method(),
    sendVerificationEmail: method(),
    resetPassword: method(),
  } satisfies AuthTransport;
  return { actions: createAuthActions(client), client };
}

const credentials = { email: "ada@example.com", password: "correct horse battery" };
const signInInput = { ...credentials, rememberMe: true };
const signUpInput = { ...credentials, name: "Ada" };
const resetInput = { password: "brand new staple secret", token: "token-1" };

const TOO_MANY = "Too many attempts. Please wait a little and try again.";
const GENERIC = "Something went wrong. Please try again.";
const NOT_CREATED = "We could not create the account. Check the fields and try again.";
const NOT_SIGNED_OUT = "Could not sign out. Please try again.";

type Run = (actions: Actions) => Promise<{ kind: string; message?: string }>;

const intents: [name: string, run: Run, rateLimited: string, fallback: string][] = [
  ["signIn", (actions) => actions.signIn(signInInput), TOO_MANY, GENERIC],
  ["signUp", (actions) => actions.signUp(signUpInput), TOO_MANY, NOT_CREATED],
  ["signInWithGoogle", (actions) => actions.signInWithGoogle(), TOO_MANY, GENERIC],
  ["signOut", (actions) => actions.signOut(), NOT_SIGNED_OUT, NOT_SIGNED_OUT],
  [
    "requestPasswordReset",
    (actions) => actions.requestPasswordReset(credentials.email),
    TOO_MANY,
    GENERIC,
  ],
  [
    "resendVerification",
    (actions) => actions.resendVerification(credentials.email),
    TOO_MANY,
    GENERIC,
  ],
  ["resetPassword", (actions) => actions.resetPassword(resetInput), TOO_MANY, GENERIC],
];

beforeEach(() => {
  const stored = new Map<string, string>();
  vi.stubGlobal("sessionStorage", {
    getItem: (key: string) => stored.get(key) ?? null,
    setItem: (key: string, value: string) => stored.set(key, value),
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe.each(intents)("%s", (_name, run, rateLimited, fallback) => {
  it("succeeds when the server accepts the request", async () => {
    const { actions } = actionsReplying(succeeded);

    expect(await run(actions)).toEqual({ kind: "ok" });
  });

  it("reports being rate limited", async () => {
    const { actions } = actionsReplying(failedWith(429));

    expect(await run(actions)).toEqual({ kind: "error", message: rateLimited });
  });

  it("recovers with an error when the network fails", async () => {
    const { actions } = actionsReplying(new TypeError("Failed to fetch"));

    expect(await run(actions)).toEqual({ kind: "error", message: fallback });
  });

  it("falls back to its own message for an unexpected failure", async () => {
    const { actions } = actionsReplying(failedWith(500));

    expect(await run(actions)).toEqual({ kind: "error", message: fallback });
  });
});

describe("signIn", () => {
  it("passes the credentials and the remember-me choice through", async () => {
    const { actions, client } = actionsReplying(succeeded);

    await actions.signIn({ ...credentials, rememberMe: false });

    expect(client.signIn.email).toHaveBeenCalledWith({ ...credentials, rememberMe: false });
  });

  it("reports wrong credentials without saying which part was wrong", async () => {
    const { actions } = actionsReplying(failedWith(401, "INVALID_EMAIL_OR_PASSWORD"));

    expect(await actions.signIn(signInInput)).toEqual({
      kind: "error",
      message: "Invalid email or password.",
    });
  });

  it("reports an unverified account and remembers its email for the verify page", async () => {
    const { actions } = actionsReplying(failedWith(403, "EMAIL_NOT_VERIFIED"));

    expect(await actions.signIn(signInInput)).toEqual({ kind: "unverified" });
    expect(readPendingEmail()).toBe(credentials.email);
  });

  it("does not remember the email when sign-in fails for another reason", async () => {
    const { actions } = actionsReplying(failedWith(401));

    await actions.signIn(signInInput);

    expect(readPendingEmail()).toBe("");
  });
});

describe("signUp", () => {
  it("remembers the email for the verify page and sends the link back there", async () => {
    const { actions, client } = actionsReplying(succeeded);

    await actions.signUp(signUpInput);

    expect(readPendingEmail()).toBe(credentials.email);
    expect(client.signUp.email).toHaveBeenCalledWith({
      ...signUpInput,
      callbackURL: "/verify-email",
    });
  });

  it("explains that the account was not created and remembers nothing", async () => {
    const { actions } = actionsReplying(failedWith(422));

    expect(await actions.signUp(signUpInput)).toEqual({
      kind: "error",
      message: "We could not create the account. Check the fields and try again.",
    });
    expect(readPendingEmail()).toBe("");
  });
});

describe("signInWithGoogle", () => {
  it("returns to the dashboard on success and to sign-in on a provider error", async () => {
    const { actions, client } = actionsReplying(succeeded);

    await actions.signInWithGoogle();

    expect(client.signIn.social).toHaveBeenCalledWith({
      provider: "google",
      callbackURL: "/dashboard",
      errorCallbackURL: "/sign-in",
    });
  });
});

describe("requestPasswordReset", () => {
  it("sends the reset link to the reset-password page", async () => {
    const { actions, client } = actionsReplying(succeeded);

    await actions.requestPasswordReset(credentials.email);

    expect(client.requestPasswordReset).toHaveBeenCalledWith({
      email: credentials.email,
      redirectTo: "/reset-password",
    });
  });
});

describe("resendVerification", () => {
  it("sends the verification link back to the verify-email page", async () => {
    const { actions, client } = actionsReplying(succeeded);

    await actions.resendVerification(credentials.email);

    expect(client.sendVerificationEmail).toHaveBeenCalledWith({
      email: credentials.email,
      callbackURL: "/verify-email",
    });
  });
});

describe("resetPassword", () => {
  it("sends the new password with the token from the link", async () => {
    const { actions, client } = actionsReplying(succeeded);

    await actions.resetPassword(resetInput);

    expect(client.resetPassword).toHaveBeenCalledWith({
      newPassword: resetInput.password,
      token: resetInput.token,
    });
  });

  it("reports a spent or expired link", async () => {
    const { actions } = actionsReplying(failedWith(400, "INVALID_TOKEN"));

    expect(await actions.resetPassword(resetInput)).toEqual({ kind: "expired-link" });
  });
});
