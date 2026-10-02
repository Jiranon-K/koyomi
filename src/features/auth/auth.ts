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
  /** Comma-separated allow-list; these addresses become admins when their account is created. */
  adminEmails?: string;
};

export type Role = "user" | "admin";

export const RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS = 60 * 60;

// Per client IP and path; `window` is in seconds. Sign-in is tight to slow password guessing, the
// reset request to stop email flooding.
export const RATE_LIMITS = {
  default: { window: 60, max: 100 },
  signInEmail: { window: 60, max: 5 },
  requestPasswordReset: { window: 300, max: 3 },
} as const;

function parseAdminEmails(adminEmails = ""): Set<string> {
  return new Set(
    adminEmails
      .split(",")
      .map((email) => email.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function createAuth({ db, secret, baseURL, sendEmail, adminEmails }: AuthOptions) {
  const admins = parseAdminEmails(adminEmails);

  return betterAuth({
    secret,
    baseURL,
    // No `client` is passed on purpose: that would enable transactions, which need a replica set.
    database: mongodbAdapter(db),
    user: {
      additionalFields: {
        // `input: false` keeps a role sent by the client out of the user record.
        role: { type: ["user", "admin"], defaultValue: "user", input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          // Roles are decided once, here. Editing the allow-list later does not touch existing users.
          before: async (user) => {
            const role: Role = admins.has(user.email.toLowerCase()) ? "admin" : "user";
            return { data: { ...user, role } };
          },
        },
      },
    },
    rateLimit: {
      // On in every environment (the library default is production only), so limits are testable.
      enabled: true,
      // The client IP is read from a single-value `x-forwarded-for`, which is what Vercel sends.
      // Any other hosting needs `advanced.ipAddress` configured first: with no header or a proxy
      // chain the IP cannot be resolved and ALL clients share one bucket per path (five sign-ins a
      // minute for the whole site), and a host reachable without a proxy trusts a header the
      // client can forge.
      // In the database, not memory: serverless instances do not share memory.
      storage: "database",
      ...RATE_LIMITS.default,
      customRules: {
        "/sign-in/email": RATE_LIMITS.signInEmail,
        "/request-password-reset": RATE_LIMITS.requestPasswordReset,
      },
    },
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
      autoSignInAfterVerification: true,
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
    return createAuth({
      db: mongoose.connection.getClient().db(),
      secret,
      baseURL,
      sendEmail,
      adminEmails: process.env.ADMIN_EMAILS,
    });
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
