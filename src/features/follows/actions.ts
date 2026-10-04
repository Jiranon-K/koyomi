"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_PATH } from "@/features/auth/paths";
import { requireSession } from "@/features/auth/session";
import { SCHEDULE_PATH } from "@/features/schedule/paths";

import { followSchema } from "./schema";
import { followShow, unfollowShow } from "./service";

function refresh(): void {
  revalidatePath(SCHEDULE_PATH);
  revalidatePath(DASHBOARD_PATH);
}

async function withShowRoute(
  userId: string,
  formData: FormData,
  run: (userId: string, showRoute: string) => Promise<unknown>,
): Promise<void> {
  const parsed = followSchema.safeParse({ showRoute: formData.get("showRoute") });
  if (!parsed.success) return;

  await run(userId, parsed.data.showRoute);
  refresh();
}

export async function followAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  await withShowRoute(user.id, formData, followShow);
}

export async function unfollowAction(formData: FormData): Promise<void> {
  const { user } = await requireSession();
  await withShowRoute(user.id, formData, unfollowShow);
}
