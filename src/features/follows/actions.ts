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
  formData: FormData,
  run: (userId: string, showRoute: string) => Promise<unknown>,
): Promise<void> {
  const { user } = await requireSession();
  const parsed = followSchema.safeParse({ showRoute: formData.get("showRoute") });
  if (!parsed.success) return;

  await run(user.id, parsed.data.showRoute);
  refresh();
}

export async function followAction(formData: FormData): Promise<void> {
  await withShowRoute(formData, followShow);
}

export async function unfollowAction(formData: FormData): Promise<void> {
  await withShowRoute(formData, unfollowShow);
}
