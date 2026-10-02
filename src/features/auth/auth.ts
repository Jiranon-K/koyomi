import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "mongodb";

import { connectDb } from "@/lib/db/mongoose";

import { sendEmail, type SendEmail } from "./email";

export type AuthOptions = {
  db: Db;
  secret: string;
  baseURL: string;
  sendEmail: SendEmail;
};

export const RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS = 60 * 60;

export function createAuth({ db, secret, baseURL, sendEmail }: AuthOptions) {
  return betterAuth({
    secret,
    baseURL,
    // No `client` is passed on purpose: that would enable transactions, which need a replica set.
    database: mongodbAdapter(db),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      // A reset usually means the old password leaked, so every existing session is signed out.
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
      sendResetPassword: async ({ user, url }) => {
        // Not awaited, for the same timing reason as the verification email below.
        sendEmail({
          to: user.email,
          kind: "reset-password",
          subject: "Reset your password",
          url,
        }).catch((error) => {
          console.error("[auth] failed to send reset password email", error);
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      sendVerificationEmail: async ({ user, url }) => {
        // Not awaited: awaiting would let response timing reveal whether the email was new.
        sendEmail({
          to: user.email,
          kind: "verify-email",
          subject: "Verify your email",
          url,
        }).catch((error) => {
          console.error("[auth] failed to send verification email", error);
        });
      },
    },
    // Must stay last so Server Actions calling auth.api.* set the session cookie.
    plugins: [nextCookies()],
  });
}

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is not set. See .env.example.`);
  }
  return value;
}

type Auth = ReturnType<typeof createAuth>;

let cached: Promise<Auth> | null = null;

// Built lazily so nothing touches the database at import time; call it inside services and pages.
export function getAuth(): Promise<Auth> {
  cached ??= (async () => {
    const secret = requireEnv("BETTER_AUTH_SECRET");
    const baseURL = requireEnv("BETTER_AUTH_URL");
    const mongoose = await connectDb();
    return createAuth({ db: mongoose.connection.getClient().db(), secret, baseURL, sendEmail });
  })();
  // A failed build (e.g. missing env) must not be cached, or fixing the env would need a restart.
  cached.catch(() => {
    cached = null;
  });
  return cached;
}

export function resetAuthForTests(): void {
  cached = null;
}
