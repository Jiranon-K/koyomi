import * as z from "zod";

export const followSchema = z.object({
  showRoute: z.string().trim().min(1).max(200),
});
