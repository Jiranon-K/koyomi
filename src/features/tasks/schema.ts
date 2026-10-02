import { z } from "zod";

export const createTaskSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Title must be at most 120 characters"),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;

export type TaskDTO = {
  id: string;
  title: string;
  done: boolean;
  createdAt: string;
  updatedAt: string;
};
