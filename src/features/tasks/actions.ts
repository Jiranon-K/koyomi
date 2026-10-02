"use server";

import { revalidatePath } from "next/cache";

import { createTaskSchema } from "./schema";
import { createTask, deleteTask, toggleTask } from "./service";

export type ActionState = { error?: string; ok?: boolean };

export async function createTaskAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const parsed = createTaskSchema.safeParse({ title: formData.get("title") });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Invalid input" };
  }
  try {
    await createTask(parsed.data);
  } catch {
    return { error: "Could not save the task. Is MongoDB running?" };
  }
  revalidatePath("/tasks");
  return { ok: true };
}

export async function toggleTaskAction(id: string): Promise<void> {
  await toggleTask(id);
  revalidatePath("/tasks");
}

export async function deleteTaskAction(id: string): Promise<void> {
  await deleteTask(id);
  revalidatePath("/tasks");
}
