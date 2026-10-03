import mongoose from "mongoose";

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
