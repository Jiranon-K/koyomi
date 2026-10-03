import { createAuthClient } from "better-auth/client";

import { DASHBOARD_PATH, RESET_PASSWORD_PATH, SIGN_IN_PATH, VERIFY_EMAIL_PATH } from "./paths";
import { rememberPendingEmail } from "./pending-email";

type Failure = { status: number; code?: string | undefined };
type Reply = { error: Failure | null };

export type AuthTransport = {
  signIn: {
    email: (input: { email: string; password: string; rememberMe: boolean }) => Promise<Reply>;
    social: (input: {
      provider: "line";
      callbackURL: string;
      errorCallbackURL: string;
      additionalParams: { bot_prompt: "normal" | "aggressive" };
    }) => Promise<Reply>;
  };
  signUp: {
    email: (input: {
      name: string;
      email: string;
      password: string;
      callbackURL: string;
    }) => Promise<Reply>;
  };
  signOut: () => Promise<Reply>;
  requestPasswordReset: (input: { email: string; redirectTo: string }) => Promise<Reply>;
  sendVerificationEmail: (input: { email: string; callbackURL: string }) => Promise<Reply>;
  resetPassword: (input: { newPassword: string; token: string }) => Promise<Reply>;
};

type Succeeded = { kind: "ok" };
type Failed = { kind: "error"; message: string };

const TOO_MANY_REQUESTS_MESSAGE = "Too many attempts. Please wait a little and try again.";
const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

const OK: Succeeded = { kind: "ok" };

async function attempt(call: () => Promise<Reply>): Promise<Failure | null> {
  try {
    const { error } = await call();
    return error;
  } catch {
    return { status: 0 };
  }
}

function failed(failure: Failure, fallback = GENERIC_ERROR_MESSAGE): Failed {
  return {
    kind: "error",
    message: failure.status === 429 ? TOO_MANY_REQUESTS_MESSAGE : fallback,
  };
}

export function createAuthActions(client: AuthTransport) {
  return {
    async signIn(input: {
      email: string;
      password: string;
      rememberMe: boolean;
    }): Promise<Succeeded | { kind: "unverified" } | Failed> {
      const failure = await attempt(() => client.signIn.email(input));
      if (!failure) return OK;
      if (failure.code === "EMAIL_NOT_VERIFIED") {
        rememberPendingEmail(input.email);
        return { kind: "unverified" };
      }
      return failure.status === 401
        ? { kind: "error", message: "Invalid email or password." }
        : failed(failure);
    },

    async signUp(input: {
      name: string;
      email: string;
      password: string;
    }): Promise<Succeeded | Failed> {
      const failure = await attempt(() =>
        client.signUp.email({ ...input, callbackURL: VERIFY_EMAIL_PATH }),
      );
      if (failure) {
        return failed(failure, "We could not create the account. Check the fields and try again.");
      }
      rememberPendingEmail(input.email);
      return OK;
    },

    /**
     * Sends the browser to LINE. On the way, LINE offers to add the bot as a friend
     * (`bot_prompt`), which is what lets reminders reach the user.
     */
    async signInWithLine(returnTo: string = DASHBOARD_PATH): Promise<Succeeded | Failed> {
      const failure = await attempt(() =>
        client.signIn.social({
          provider: "line",
          callbackURL: returnTo,
          errorCallbackURL: SIGN_IN_PATH,
          additionalParams: { bot_prompt: "normal" },
        }),
      );
      return failure ? failed(failure) : OK;
    },

    async signOut(): Promise<Succeeded | Failed> {
      const failure = await attempt(() => client.signOut());
      return failure ? { kind: "error", message: "Could not sign out. Please try again." } : OK;
    },

    async requestPasswordReset(email: string): Promise<Succeeded | Failed> {
      const failure = await attempt(() =>
        client.requestPasswordReset({ email, redirectTo: RESET_PASSWORD_PATH }),
      );
      return failure ? failed(failure) : OK;
    },

    async resendVerification(email: string): Promise<Succeeded | Failed> {
      const failure = await attempt(() =>
        client.sendVerificationEmail({ email, callbackURL: VERIFY_EMAIL_PATH }),
      );
      return failure ? failed(failure) : OK;
    },

    async resetPassword(input: {
      password: string;
      token: string;
    }): Promise<Succeeded | { kind: "expired-link" } | Failed> {
      const failure = await attempt(() =>
        client.resetPassword({ newPassword: input.password, token: input.token }),
      );
      if (!failure) return OK;
      return failure.code === "INVALID_TOKEN" ? { kind: "expired-link" } : failed(failure);
    },
  };
}

export const {
  signIn,
  signUp,
  signInWithLine,
  signOut,
  requestPasswordReset,
  resendVerification,
  resetPassword,
} = createAuthActions(createAuthClient());
