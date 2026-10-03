import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { nextCookies } from "better-auth/next-js";
import type { GoogleOptions } from "better-auth/social-providers";
import type { Db } from "mongodb";

import { connectDb } from "@/lib/db/mongoose";
import { authEnv, googleEnv } from "@/lib/env";

import { sendEmail, type EmailMessage, type SendEmail } from "./email";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./schema";

export type AuthOptions = {
  db: Db;
  secret: string;
  baseURL: string;
  sendEmail: SendEmail;
  adminEmails?: string;
  google?: GoogleOptions & { clientId: string; clientSecret: string };
};

export type Role = "user" | "admin";

export function isGoogleEnabled(): boolean {
  return googleEnv() !== undefined;
}

export const RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS = 60 * 60;

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

export function createAuth({
  db,
  secret,
  baseURL,
  sendEmail,
  adminEmails,
  google,
}: AuthOptions) {
  const admins = parseAdminEmails(adminEmails);
  const sendInBackground = (message: EmailMessage) => {
    sendEmail(message).catch((error) => {
      console.error(`[auth] failed to send ${message.kind} email`, error);
    });
  };

  return betterAuth({
    secret,
    baseURL,
    database: mongodbAdapter(db),
    user: {
      additionalFields: {
        role: { type: ["user", "admin"], defaultValue: "user", input: false },
      },
    },
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            const role: Role = admins.has(user.email.toLowerCase()) ? "admin" : "user";
            return { data: { ...user, role } };
          },
        },
      },
    },
    socialProviders: google ? { google: { ...google, requireEmailVerification: true } } : {},
    rateLimit: {
      enabled: true,
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
      minPasswordLength: PASSWORD_MIN_LENGTH,
      maxPasswordLength: PASSWORD_MAX_LENGTH,
      revokeSessionsOnPasswordReset: true,
      resetPasswordTokenExpiresIn: RESET_PASSWORD_TOKEN_EXPIRES_IN_SECONDS,
      sendResetPassword: async ({ user, url }) => {
        sendInBackground({
          to: user.email,
          kind: "reset-password",
          subject: "Reset your password",
          url,
        });
      },
    },
    emailVerification: {
      sendOnSignUp: true,
      autoSignInAfterVerification: true,
      sendVerificationEmail: async ({ user, url }) => {
        sendInBackground({
          to: user.email,
          kind: "verify-email",
          subject: "Verify your email",
          url,
        });
      },
    },
    plugins: [nextCookies()],
  });
}

type Auth = ReturnType<typeof createAuth>;

let cached: Promise<Auth> | null = null;

export function getAuth(): Promise<Auth> {
  if (cached) return cached;
  const building = (async () => {
    const env = authEnv();
    const mongoose = await connectDb();
    return createAuth({
      db: mongoose.connection.getClient().db(),
      secret: env.BETTER_AUTH_SECRET,
      baseURL: env.BETTER_AUTH_URL,
      sendEmail,
      adminEmails: env.ADMIN_EMAILS,
      google: googleEnv(),
    });
  })();
  cached = building;
  building.catch(() => {
    if (cached === building) cached = null;
  });
  return building;
}

export function resetAuthForTests(): void {
  cached = null;
}
