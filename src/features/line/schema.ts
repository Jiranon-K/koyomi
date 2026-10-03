import * as z from "zod";

export const remindersSchema = z.object({
  on: z.enum(["true", "false"]).transform((value) => value === "true"),
});

export type SettingsActionState = { error: string | null };

export const lineEventSchema = z.looseObject({
  type: z.string(),
  timestamp: z.number().optional(),
  source: z.looseObject({ type: z.string(), userId: z.string().optional() }).optional(),
});

export type LineEvent = z.infer<typeof lineEventSchema>;

export const lineWebhookBodySchema = z.looseObject({ events: z.array(z.unknown()) });
