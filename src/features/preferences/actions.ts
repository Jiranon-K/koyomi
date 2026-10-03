"use server";

import { revalidatePath } from "next/cache";

import { DASHBOARD_PATH, SETTINGS_PATH } from "@/features/auth/paths";
import { requireSession } from "@/features/auth/session";

import { dashboardViewSchema, type PreferenceActionState } from "./schema";
import { setDashboardView } from "./service";

export async function setDashboardViewAction(
  _previous: PreferenceActionState,
  formData: FormData,
): Promise<PreferenceActionState> {
  const { user } = await requireSession();

  const input = dashboardViewSchema.safeParse({ view: formData.get("view") });
  if (!input.success) return { error: "Something went wrong. Please try again." };

  await setDashboardView(user.id, input.data.view);
  revalidatePath(SETTINGS_PATH);
  revalidatePath(DASHBOARD_PATH);
  return { error: null };
}
