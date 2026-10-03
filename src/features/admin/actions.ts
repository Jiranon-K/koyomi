"use server";

import { revalidatePath } from "next/cache";

import { ADMIN_PATH } from "@/features/auth/paths";
import { requireAdmin } from "@/features/auth/session";
import type { SyncRunDoc } from "@/features/schedule/model";
import { runScheduleSync } from "@/features/schedule/sync";

import type { SyncNowState } from "./schema";

export async function syncNowAction(): Promise<SyncNowState> {
  await requireAdmin();

  let run: SyncRunDoc;
  try {
    run = await runScheduleSync();
  } catch (error) {
    console.error("[admin] the sync could not run", error);
    return { error: "The sync could not run. Please try again.", notice: null };
  }

  revalidatePath(ADMIN_PATH);
  if (run.outcome === "failure") {
    return { error: "The sync failed. The reason is recorded above.", notice: null };
  }
  return { error: null, notice: `Synced: ${run.episodes} episodes of ${run.shows} shows.` };
}
