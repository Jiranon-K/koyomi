import * as z from "zod";

type Source = Record<string, string | undefined>;

const blankAsUnset = (value: unknown) => (value === "" ? undefined : value);

const text = (name: string) => z.string({ error: `${name} is not set.` });

const dbSchema = z.object({
  MONGODB_URI: z.preprocess(
    blankAsUnset,
    text("MONGODB_URI").regex(
      /^mongodb(\+srv)?:\/\//,
      "MONGODB_URI must start with mongodb:// or mongodb+srv://.",
    ),
  ),
});

const authSchema = z.object({
  BETTER_AUTH_SECRET: z.preprocess(
    blankAsUnset,
    text("BETTER_AUTH_SECRET").min(32, "BETTER_AUTH_SECRET must be at least 32 characters."),
  ),
  BETTER_AUTH_URL: z.preprocess(
    blankAsUnset,
    text("BETTER_AUTH_URL")
      .refine((value) => URL.canParse(value), {
        error: "BETTER_AUTH_URL must be a full URL such as http://localhost:3000.",
        abort: true,
      })
      .refine((value) => !value.endsWith("/"), "BETTER_AUTH_URL must not end with a slash."),
  ),
  ADMIN_EMAILS: z.preprocess(blankAsUnset, z.string().optional()),
});

function parse<Schema extends z.ZodType>(schema: Schema, source: Source): z.output<Schema> {
  const result = schema.safeParse(source);
  if (result.success) return result.data;
  const problems = result.error.issues.map((issue) => issue.message).join(" ");
  throw new Error(`${problems} See .env.example.`);
}

export function dbEnv(source: Source = process.env) {
  return parse(dbSchema, source);
}

export function authEnv(source: Source = process.env) {
  return parse(authSchema, source);
}

const fakesSchema = z.object({
  USE_FAKES: z.preprocess(
    blankAsUnset,
    z.enum(["true", "false"], { error: "USE_FAKES must be true or false." }).default("false"),
  ),
});

const scheduleSchema = z.object({
  ANIMESCHEDULE_TOKEN: z.preprocess(blankAsUnset, text("ANIMESCHEDULE_TOKEN")),
});

/** True when the external services (schedule source, LINE sender, job queue) are replaced by fakes. */
export function fakesEnabled(source: Source = process.env): boolean {
  return parse(fakesSchema, source).USE_FAKES === "true";
}

/** What the real schedule source needs. Not read when the fakes are on. */
export function scheduleEnv(source: Source = process.env) {
  return parse(scheduleSchema, source);
}

/** Whether the unauthenticated `/api/dev` routes answer: only with the fakes, or under `next dev`. */
export function devRoutesEnabled(source: Source = process.env): boolean {
  return fakesEnabled(source) || source.NODE_ENV === "development";
}

const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

/**
 * LINE Login credentials, or `undefined` when LINE Login is off. Never throws: the app must run
 * without LINE. A half-configured pair is reported once, by variable name only.
 */
export function lineLoginEnv(
  source: Source = process.env,
): { clientId: string; clientSecret: string } | undefined {
  const clientId = source.LINE_LOGIN_CHANNEL_ID;
  const clientSecret = source.LINE_LOGIN_CHANNEL_SECRET;
  if (clientId && clientSecret) return { clientId, clientSecret };
  if (clientId || clientSecret) {
    const missing = clientId ? "LINE_LOGIN_CHANNEL_SECRET" : "LINE_LOGIN_CHANNEL_ID";
    warnOnce(
      `${missing} is not set, so LINE Login is off. Set both LINE_LOGIN_CHANNEL_ID and LINE_LOGIN_CHANNEL_SECRET, or leave both empty. See .env.example.`,
    );
  }
  return undefined;
}

/**
 * The Messaging API channel secret that signs webhook calls, or `undefined` when it is not set.
 * A caller must then refuse the request; it must never skip the signature check.
 */
export function lineWebhookEnv(
  source: Source = process.env,
): { channelSecret: string } | undefined {
  const channelSecret = source.LINE_MESSAGING_CHANNEL_SECRET;
  return channelSecret ? { channelSecret } : undefined;
}

const BOT_BASIC_ID = /^@[\w.-]+$/;

/** The bot's add-friend link, built from its basic ID, or `undefined` when that is not set. */
export function lineBotEnv(source: Source = process.env): { addFriendUrl: string } | undefined {
  const basicId = source.LINE_BOT_BASIC_ID;
  if (!basicId) return undefined;
  if (!BOT_BASIC_ID.test(basicId)) {
    warnOnce(
      "LINE_BOT_BASIC_ID must look like @123abcde, so the add-friend link is off. See .env.example.",
    );
    return undefined;
  }
  return { addFriendUrl: `https://line.me/R/ti/p/${encodeURIComponent(basicId)}` };
}

/** The public origin of this app (no trailing slash): what links in messages and job URLs use. */
export function appUrl(source: Source = process.env): string {
  return authEnv(source).BETTER_AUTH_URL;
}

/**
 * The Messaging API channel access token that pushes are sent with, or `undefined` when it is not
 * set. A caller must then report the push as failed, by variable name.
 */
export function lineMessagingEnv(
  source: Source = process.env,
): { channelAccessToken: string } | undefined {
  const channelAccessToken = source.LINE_MESSAGING_CHANNEL_ACCESS_TOKEN;
  return channelAccessToken ? { channelAccessToken } : undefined;
}

const qstashSchema = z.object({
  QSTASH_TOKEN: z.preprocess(blankAsUnset, text("QSTASH_TOKEN")),
  QSTASH_URL: z.preprocess(
    blankAsUnset,
    z
      .string()
      .refine((value) => URL.canParse(value), "QSTASH_URL must be a full URL.")
      .default("https://qstash.upstash.io"),
  ),
});

/** What publishing to QStash needs. Not read when the fakes are on. */
export function qstashEnv(source: Source = process.env): { token: string; url: string } {
  const { QSTASH_TOKEN, QSTASH_URL } = parse(qstashSchema, source);
  return { token: QSTASH_TOKEN, url: QSTASH_URL.replace(/\/+$/, "") };
}

/**
 * The two keys QStash signs job calls with, or `undefined` unless both are set. A job endpoint
 * must then refuse the call; it must never skip the signature check.
 */
export function qstashSigningEnv(
  source: Source = process.env,
): { currentSigningKey: string; nextSigningKey: string } | undefined {
  const currentSigningKey = source.QSTASH_CURRENT_SIGNING_KEY;
  const nextSigningKey = source.QSTASH_NEXT_SIGNING_KEY;
  if (currentSigningKey && nextSigningKey) return { currentSigningKey, nextSigningKey };
  if (currentSigningKey || nextSigningKey) {
    const missing = currentSigningKey ? "QSTASH_NEXT_SIGNING_KEY" : "QSTASH_CURRENT_SIGNING_KEY";
    warnOnce(
      `${missing} is not set, so the job endpoints refuse every call. Set both QSTASH_CURRENT_SIGNING_KEY and QSTASH_NEXT_SIGNING_KEY. See .env.example.`,
    );
  }
  return undefined;
}
