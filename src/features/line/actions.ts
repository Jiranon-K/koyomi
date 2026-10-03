"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { getAuth, isLineLoginEnabled } from "@/features/auth/auth";
import { disconnectLine, lineConnectUrl } from "@/features/auth/line-account";
import { lineDisconnectErrorMessage } from "@/features/auth/line-errors";
import { SETTINGS_PATH } from "@/features/auth/paths";
import { requireSession } from "@/features/auth/session";

import { remindersSchema, type SettingsActionState } from "./schema";
import { REMINDER_CAP, removeLineLink, setReminders } from "./service";

const DONE: SettingsActionState = { error: null };

/** Send the signed-in user to LINE to connect their LINE account; they come back to settings. */
export async function connectLineAction(): Promise<SettingsActionState> {
  await requireSession();
  if (!isLineLoginEnabled()) return { error: "LINE is not set up on this server." };

  let url: string;
  try {
    url = await lineConnectUrl(await getAuth(), await headers());
  } catch (error) {
    console.error("[line] could not start connecting LINE", error);
    return { error: "LINE could not be reached. Please try again." };
  }
  redirect(url);
}

/** Remove the LINE account from the signed-in user, and with it the reminder place they held. */
export async function disconnectLineAction(): Promise<SettingsActionState> {
  const { user } = await requireSession();

  const outcome = await disconnectLine(await getAuth(), await headers());
  if (outcome.kind !== "ok") return { error: lineDisconnectErrorMessage(outcome) };

  await removeLineLink(user.id);
  revalidatePath(SETTINGS_PATH);
  return DONE;
}

/** Flip the signed-in user's reminder switch. */
export async function setRemindersAction(
  _previous: SettingsActionState,
  formData: FormData,
): Promise<SettingsActionState> {
  const { user } = await requireSession();

  const input = remindersSchema.safeParse(Object.fromEntries(formData));
  if (!input.success) return { error: "Something went wrong. Please try again." };

  const outcome = await setReminders(user.id, input.data.on);
  revalidatePath(SETTINGS_PATH);
  switch (outcome.kind) {
    case "ok":
      return DONE;
    case "full":
      return {
        error: `Reminders are full: all ${REMINDER_CAP} places are taken. You can switch yours on when someone else switches theirs off.`,
      };
    case "not-linked":
      return { error: "Connect LINE before switching reminders on." };
  }
}
