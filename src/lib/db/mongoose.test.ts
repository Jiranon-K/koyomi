import mongoose from "mongoose";
import { MongoMemoryServer } from "mongodb-memory-server";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { connectDb } from "./mongoose";

let server: MongoMemoryServer;

beforeAll(async () => {
  server = await MongoMemoryServer.create();
});

afterAll(async () => {
  await mongoose.disconnect();
  await server.stop();
});

describe("connectDb", () => {
  it("throws a helpful error when MONGODB_URI is missing", async () => {
    delete process.env.MONGODB_URI;
    await expect(connectDb()).rejects.toThrow(/MONGODB_URI/);
  });

  it("connects and reuses the same connection", async () => {
    process.env.MONGODB_URI = server.getUri("connect-test");
    const first = await connectDb();
    const second = await connectDb();
    expect(first).toBe(second);
    expect(first.connection.readyState).toBe(1);
  });
});
