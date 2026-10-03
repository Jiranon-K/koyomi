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

export function fakesEnabled(source: Source = process.env): boolean {
  return parse(fakesSchema, source).USE_FAKES === "true";
}

export function scheduleEnv(source: Source = process.env) {
  return parse(scheduleSchema, source);
}

export function devRoutesEnabled(source: Source = process.env): boolean {
  return fakesEnabled(source) || source.NODE_ENV === "development";
}

const warned = new Set<string>();

function warnOnce(message: string): void {
  if (warned.has(message)) return;
  warned.add(message);
  console.warn(message);
}

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

export function lineWebhookEnv(
  source: Source = process.env,
): { channelSecret: string } | undefined {
  const channelSecret = source.LINE_MESSAGING_CHANNEL_SECRET;
  return channelSecret ? { channelSecret } : undefined;
}

const BOT_BASIC_ID = /^@[\w.-]+$/;

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

export function appUrl(source: Source = process.env): string {
  return authEnv(source).BETTER_AUTH_URL;
}

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

export function qstashEnv(source: Source = process.env): { token: string; url: string } {
  const { QSTASH_TOKEN, QSTASH_URL } = parse(qstashSchema, source);
  return { token: QSTASH_TOKEN, url: QSTASH_URL.replace(/\/+$/, "") };
}

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

const SECRET_NAME = /SECRET|TOKEN|KEY|PASSWORD/;
const SECRET_MIN_LENGTH = 8;
const URL_CREDENTIALS = /([a-z][a-z0-9+.-]*:\/\/)[^\s/@]+@/gi;
const BEARER = /\bBearer\s+[\w.~+/=-]+/g;

export function redactSecrets(text: string, source: Source = process.env): string {
  const secrets = Object.entries(source)
    .flatMap(([name, value]) =>
      value &&
      value.length >= SECRET_MIN_LENGTH &&
      (SECRET_NAME.test(name) || name === "MONGODB_URI")
        ? [{ name, value }]
        : [],
    )
    .sort((a, b) => b.value.length - a.value.length);

  let safe = text;
  for (const { name, value } of secrets) safe = safe.replaceAll(value, `[${name}]`);
  return safe.replace(URL_CREDENTIALS, "$1[hidden]@").replace(BEARER, "Bearer [hidden]");
}
