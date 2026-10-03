import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";

import { MongoMemoryServer } from "mongodb-memory-server";

const port = process.env.E2E_PORT ?? "3100";
const next = "node_modules/next/dist/bin/next";

if (!process.env.E2E_SKIP_BUILD) {
  const build = spawnSync(process.execPath, [next, "build"], { stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const mongo = await MongoMemoryServer.create();
mkdirSync(".e2e", { recursive: true });
const log = createWriteStream(".e2e/server.log");
// Tests that must change data behind the server's back (to prove a cache, or to seed a linked
// LINE account) connect with this; see e2e/seed.ts.
writeFileSync(".e2e/mongo-uri", mongo.getUri("e2e"));

// LINE is off unless a run opts in with E2E_-prefixed placeholders, whatever the shell or
// .env.local holds.
const line = Object.fromEntries(
  [
    "LINE_LOGIN_CHANNEL_ID",
    "LINE_LOGIN_CHANNEL_SECRET",
    "LINE_MESSAGING_CHANNEL_SECRET",
    "LINE_BOT_BASIC_ID",
  ].map((name) => [name, process.env[`E2E_${name}`] ?? ""]),
);

const server = spawn(process.execPath, [next, "start", "-p", port], {
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri("e2e"),
    BETTER_AUTH_SECRET: "e2e-only-value-e2e-only-value-e2e-only-value",
    BETTER_AUTH_URL: `http://localhost:${port}`,
    ADMIN_EMAILS: "",
    USE_FAKES: "true",
    ...line,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
server.stdout.pipe(log, { end: false });
server.stderr.pipe(log, { end: false });

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => server.kill());
}
server.on("exit", (code) => {
  void mongo.stop().finally(() => process.exit(code ?? 0));
});
