import mongoose, { type Model, type Schema } from "mongoose";

import { dbEnv } from "@/lib/env";

type Cache = { promise: Promise<typeof mongoose> | null };

const globalCache = globalThis as typeof globalThis & { _mongoose?: Cache };
const cache: Cache = (globalCache._mongoose ??= { promise: null });

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.promise) return cache.promise;

  const connecting = mongoose.connect(dbEnv().MONGODB_URI, { bufferCommands: false });
  cache.promise = connecting;
  connecting.catch(() => {
    if (cache.promise === connecting) cache.promise = null;
  });
  return connecting;
}

export function defineModel<Doc>(name: string, schema: Schema<Doc>): Model<Doc> {
  const existing = mongoose.models[name] as Model<Doc> | undefined;
  return existing ?? mongoose.model<Doc>(name, schema);
}

export function indexesReady(build: () => Promise<unknown>): () => Promise<void> {
  let indexes: Promise<unknown> | null = null;
  return async () => {
    await connectDb();
    const building = (indexes ??= build());
    try {
      await building;
    } catch (error) {
      if (indexes === building) indexes = null;
      throw error;
    }
  };
}

export function isDuplicateKey(error: unknown): boolean {
  return error instanceof mongoose.mongo.MongoServerError && error.code === 11000;
}
