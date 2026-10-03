import mongoose from "mongoose";

type Cache = { promise: Promise<typeof mongoose> | null };

const globalCache = globalThis as typeof globalThis & { _mongoose?: Cache };
const cache: Cache = (globalCache._mongoose ??= { promise: null });

export function connectDb(): Promise<typeof mongoose> {
  if (cache.promise) return cache.promise;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    return Promise.reject(new Error("MONGODB_URI is not set. Copy .env.example to .env.local."));
  }

  const connecting = mongoose.connect(uri, { bufferCommands: false });
  cache.promise = connecting;
  connecting.catch(() => {
    if (cache.promise === connecting) cache.promise = null;
  });
  return connecting;
}
