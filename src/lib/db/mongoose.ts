import mongoose from "mongoose";

type Cache = { conn: typeof mongoose | null; promise: Promise<typeof mongoose> | null };

// Cache the connection on globalThis so dev hot reloads reuse it instead of opening a new one.
const globalCache = globalThis as typeof globalThis & { _mongoose?: Cache };
const cache: Cache = (globalCache._mongoose ??= { conn: null, promise: null });

export async function connectDb(): Promise<typeof mongoose> {
  if (cache.conn) return cache.conn;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("MONGODB_URI is not set. Copy .env.example to .env.local.");
  }

  cache.promise ??= mongoose.connect(uri, { bufferCommands: false });
  try {
    cache.conn = await cache.promise;
  } catch (error) {
    cache.promise = null;
    throw error;
  }
  return cache.conn;
}
