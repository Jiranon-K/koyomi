import { betterAuth } from "better-auth";
import { mongodbAdapter } from "better-auth/adapters/mongodb";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import type { Db } from "mongodb";

import { recordLineAccount } from "@/features/line/service";
import { connectDb } from "@/lib/db/mongoose";
import { authEnv, lineLoginEnv } from "@/lib/env";

import { sendEmail, type EmailMessage, type SendEmail } from "./email";
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./schema";

export type AuthOptions = {
  db: Db;
  secret: string;
  baseURL: string;
  sendEmail: SendEmail;
  adminEmails?: string;
  line?: { clientId: string; clientSecret: string } | undefined;
  onLineAccount?: (account: LineAccount) => Promise<void>;
};

/** A LINE account attached to an app user: just linked, or just used to sign in. */
export type LineAccount = { userId: string; lineUserId: string; accessToken?: string };

export const LINE_PROVIDER_ID = "line";

type StoredAccount = {
  providerId: string;
  accountId: string;
  userId: string;
  accessToken?: string | null | undefined;
};

// What the database hooks below need from the request context Better Auth hands them.
type HookContext = {
  context: {
    internalAdapter: {
      findUserById: (userId: string) => Promise<{ emailVerified: boolean } | null>;
      findAccounts: (userId: string) => Promise<StoredAccount[]>;
    };
  };
} | null;

export function isLineLoginEnabled(): boolean {
  return lineLoginEnv() !== undefined;
}

// Better Auth refuses a profile with no email before it even looks for a linked account, so a
// LINE profile without one (the email scope needs approval in the LINE console) is given a
// stand-in. The stand-in only lets an already linked user sign in: it is never stored, and no
// account is ever created from it.
const LINE_PLACEHOLDER_EMAIL = /^line-user-[^@]+@no-email\.invalid$/;
const LINE_EMAIL_NOT_FOUND = "email_not_found";

function linePlaceholderEmail(lineUserId: string): string {
  return `line-user-${lineUserId.toLowerCase()}@no-email.invalid`;
}

function isLinePlaceholderEmail(email: string): boolean {
  return LINE_PLACEHOLDER_EMAIL.test(email.toLowerCase());
}

export type Role = "user" | "admin";

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
  line,
  onLineAccount,
}: AuthOptions) {
  const admins = parseAdminEmails(adminEmails);
  const sendInBackground = (message: EmailMessage) => {
    sendEmail(message).catch((error) => {
      console.error(`[auth] failed to send ${message.kind} email`, error);
    });
  };

  // The app hears about a LINE account only while its user's email is verified. A LINE sign-up
  // whose emailed link was never used gets nothing in the app: no link row, no reminder place.
  const reportLineAccounts = async (
    accounts: StoredAccount[],
    isVerified: () => Promise<boolean>,
  ) => {
    const lineAccounts = accounts.filter((account) => account.providerId === LINE_PROVIDER_ID);
    if (!onLineAccount || lineAccounts.length === 0) return;
    try {
      if (!(await isVerified())) return;
      for (const account of lineAccounts) {
        await onLineAccount({
          userId: account.userId,
          lineUserId: account.accountId,
          ...(account.accessToken ? { accessToken: account.accessToken } : {}),
        });
      }
    } catch (error) {
      console.error("[auth] the LINE account listener failed", error);
    }
  };

  // A LINE account was linked, or used to sign in (which refreshes its tokens).
  const onAccountWritten = (account: StoredAccount, hook: HookContext) =>
    reportLineAccounts([account], async () => {
      const user = await hook?.context.internalAdapter.findUserById(account.userId);
      return user?.emailVerified === true;
    });

  // A user changed; the change that matters is the emailed link being used after a LINE sign-up.
  const onUserUpdated = async (user: { id: string; emailVerified: boolean }, hook: HookContext) => {
    if (!onLineAccount || !user.emailVerified || !hook) return;
    try {
      const accounts = await hook.context.internalAdapter.findAccounts(user.id);
      await reportLineAccounts(accounts, async () => true);
    } catch (error) {
      console.error("[auth] could not look up the LINE accounts of a user", error);
    }
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
            if (isLinePlaceholderEmail(user.email)) {
              throw new APIError("UNPROCESSABLE_ENTITY", {
                code: LINE_EMAIL_NOT_FOUND,
                message: "LINE did not share an email address",
              });
            }
            const role: Role = admins.has(user.email.toLowerCase()) ? "admin" : "user";
            return { data: { ...user, role } };
          },
        },
        update: { after: onUserUpdated },
      },
      account: {
        create: { after: onAccountWritten },
        update: { after: onAccountWritten },
      },
    },
    // LINE never reports an email as verified, so a LINE-supplied address is held to the rule that
    // guards email sign-up: no session until the emailed link is used. The browser cannot hand
    // over an ID token; the profile only ever comes from LINE's token endpoint.
    socialProviders: line
      ? {
          line: {
            ...line,
            requireEmailVerification: true,
            disableIdTokenSignIn: true,
            mapProfileToUser: (profile) =>
              profile.email ? {} : { email: linePlaceholderEmail(profile.sub) },
          },
        }
      : {},
    // Connecting LINE is always an explicit act by a signed-in user ("Connect LINE" in settings),
    // which is why LINE is trusted there and its email may differ or be missing. A LINE sign-in
    // never attaches itself to an existing account because the emails match.
    account: {
      accountLinking: {
        trustedProviders: [LINE_PROVIDER_ID],
        allowDifferentEmails: true,
        disableImplicitLinking: true,
      },
    },
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

export type Auth = ReturnType<typeof createAuth>;

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
      line: lineLoginEnv(),
      onLineAccount: recordLineAccount,
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
