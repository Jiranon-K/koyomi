import * as z from "zod";

/** The form a follow or unfollow button submits. Whether the show exists is the service's check. */
export const followSchema = z.object({
  showRoute: z.string().trim().min(1).max(200),
});
