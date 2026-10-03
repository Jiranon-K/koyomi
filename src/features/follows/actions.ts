"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_PATH } from "@/features/auth/paths";
import { requireSession } from "@/features/auth/session";
import { SCHEDULE_PATH } from "@/features/schedule/paths";

import { followSchema } from "./schema";
import { followShow, unfollowShow } from "./service";

// Both pages render follow state per request; revalidating them makes the open page refetch.
function refresh(): void {
  revalidatePath(SCHEDULE_PATH);
  revalidatePath(DASHBOARD_PATH);
}

export async function followAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const parsed = followSchema.safeParse({ showRoute: formData.get("showRoute") });
  if (!parsed.success) return;

  await followShow(user.id, parsed.data.showRoute);
  refresh();
}

export async function unfollowAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  const parsed = followSchema.safeParse({ showRoute: formData.get("showRoute") });
  if (!parsed.success) return;

  await unfollowShow(user.id, parsed.data.showRoute);
  refresh();
}
