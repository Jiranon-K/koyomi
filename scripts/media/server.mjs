import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, readFileSync } from "node:fs";

import { MongoClient } from "mongodb";

/* The real app on a media database of its own, dropped at the start of every run. */
export const MEDIA_EMAIL = "demo@example.com";

const port = process.env.E2E_PORT ?? "3101";
const next = "node_modules/next/dist/bin/next";

if (!process.env.E2E_SKIP_BUILD) {
  const build = spawnSync(process.execPath, [next, "build"], { stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const dev = process.env.MONGODB_URI || readEnvLocal("MONGODB_URI");
if (!dev) throw new Error("MONGODB_URI is not set in the environment or .env.local");
const uri = new URL(dev);
uri.pathname = "/koyomi-media";

const client = new MongoClient(uri.toString());
await client.connect();
await client.db().dropDatabase();
await client.close();

mkdirSync(".e2e", { recursive: true });
const log = createWriteStream(".e2e/server.log");
const server = spawn(process.execPath, [next, "start", "-p", port], {
  env: {
    ...process.env,
    MONGODB_URI: uri.toString(),
    BETTER_AUTH_URL: `http://localhost:${port}`,
    ADMIN_EMAILS: MEDIA_EMAIL,
    USE_FAKES: "",
  },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.pipe(log, { end: false });
server.stderr.pipe(log, { end: false });
for (const signal of ["SIGINT", "SIGTERM"]) process.on(signal, () => server.kill());
server.on("exit", (code) => process.exit(code ?? 0));

function readEnvLocal(name) {
  const line = readFileSync(".env.local", "utf8")
    .split(/\r?\n/)
    .find((l) => l.trim().startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).trim() : "";
}
