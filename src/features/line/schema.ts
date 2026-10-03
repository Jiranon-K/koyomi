import * as z from "zod";

/** The reminder switch on the settings page: a form field that is the text "true" or "false". */
export const remindersSchema = z.object({
  on: z.enum(["true", "false"]).transform((value) => value === "true"),
});

/** What a settings Server Action hands back to its form: an error to show, or nothing. */
export type SettingsActionState = { error: string | null };

/**
 * One webhook event, as far as this app reads it. LINE sends many event types with many fields;
 * the rest is kept as it came, for the handler of that type.
 */
export const lineEventSchema = z.looseObject({
  type: z.string(),
  timestamp: z.number().optional(),
  source: z.looseObject({ type: z.string(), userId: z.string().optional() }).optional(),
});

export type LineEvent = z.infer<typeof lineEventSchema>;

export const lineWebhookBodySchema = z.looseObject({ events: z.array(z.unknown()) });
