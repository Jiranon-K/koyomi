import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import { Task } from "./model";
import { createTask, deleteTask, listTasks, toggleTask } from "./service";

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
  process.env.MONGODB_URI = server.getUri("template-test");
});

beforeEach(async () => {
  const { connectDb } = await import("@/lib/db/mongoose");
  await connectDb();
  await Task.deleteMany({});
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
});

describe("task service", () => {
  it("creates a task that starts not done", async () => {
    const task = await createTask({ title: "first" });
    expect(task).toMatchObject({ title: "first", done: false });
    expect(await listTasks()).toHaveLength(1);
  });

  it("rejects invalid input", async () => {
    await expect(createTask({ title: "" })).rejects.toThrow();
  });

  it("toggles done on and off", async () => {
    const { id } = await createTask({ title: "toggle me" });
    expect((await toggleTask(id))?.done).toBe(true);
    expect((await toggleTask(id))?.done).toBe(false);
  });

  it("returns null or false for malformed or unknown ids", async () => {
    expect(await toggleTask("not-an-id")).toBeNull();
    expect(await deleteTask("not-an-id")).toBe(false);
    expect(await deleteTask(new mongoose.Types.ObjectId().toString())).toBe(false);
  });

  it("deletes a task", async () => {
    const { id } = await createTask({ title: "bye" });
    expect(await deleteTask(id)).toBe(true);
    expect(await listTasks()).toHaveLength(0);
  });
});
