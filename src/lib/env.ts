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

/** True when the external services (the schedule source so far) are replaced by their fakes. */
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
