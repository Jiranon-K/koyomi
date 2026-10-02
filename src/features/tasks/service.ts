import { isValidObjectId } from "mongoose";

import { connectDb } from "@/lib/db/mongoose";

import { Task, type TaskDoc } from "./model";
import { createTaskSchema, type TaskDTO } from "./schema";

function toDTO(doc: TaskDoc): TaskDTO {
  return {
    id: doc._id.toString(),
    title: doc.title,
    done: doc.done,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listTasks(): Promise<TaskDTO[]> {
  await connectDb();
  const docs = await Task.find().sort({ createdAt: -1 }).lean<TaskDoc[]>();
  return docs.map(toDTO);
}

export async function createTask(input: unknown): Promise<TaskDTO> {
  const { title } = createTaskSchema.parse(input);
  await connectDb();
  const doc = await Task.create({ title });
  return toDTO(doc.toObject() as TaskDoc);
}

export async function toggleTask(id: string): Promise<TaskDTO | null> {
  if (!isValidObjectId(id)) return null;
  await connectDb();
  const doc = await Task.findById(id);
  if (!doc) return null;
  doc.done = !doc.done;
  await doc.save();
  return toDTO(doc.toObject() as TaskDoc);
}

export async function deleteTask(id: string): Promise<boolean> {
  if (!isValidObjectId(id)) return false;
  await connectDb();
  const result = await Task.deleteOne({ _id: id });
  return result.deletedCount === 1;
}
