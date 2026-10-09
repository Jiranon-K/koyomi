import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync, writeFileSync } from "node:fs";

import { MongoMemoryServer } from "mongodb-memory-server";

import { E2E_SIGNING_KEYS } from "./signing-keys.mjs";

const port = process.env.E2E_PORT ?? "3100";
const dir = process.env.E2E_DIR ?? ".e2e";
const next = "node_modules/next/dist/bin/next";

if (!process.env.E2E_SKIP_BUILD) {
  const build = spawnSync(process.execPath, [next, "build"], { stdio: "inherit" });
  if (build.status !== 0) process.exit(build.status ?? 1);
}

const mongo = await MongoMemoryServer.create();
mkdirSync(dir, { recursive: true });
const log = createWriteStream(`${dir}/server.log`);
writeFileSync(`${dir}/mongo-uri`, mongo.getUri("e2e"));

const line = Object.fromEntries(
  [
    "LINE_LOGIN_CHANNEL_ID",
    "LINE_LOGIN_CHANNEL_SECRET",
    "LINE_MESSAGING_CHANNEL_SECRET",
    "LINE_MESSAGING_CHANNEL_ACCESS_TOKEN",
    "LINE_BOT_BASIC_ID",
    "QSTASH_TOKEN",
    "QSTASH_URL",
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
    QSTASH_CURRENT_SIGNING_KEY: E2E_SIGNING_KEYS.current,
    QSTASH_NEXT_SIGNING_KEY: E2E_SIGNING_KEYS.next,
    QSTASH_DEV: "",
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
