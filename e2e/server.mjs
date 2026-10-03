import { spawn, spawnSync } from "node:child_process";
import { createWriteStream, mkdirSync } from "node:fs";

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

const server = spawn(process.execPath, [next, "start", "-p", port], {
  env: {
    ...process.env,
    MONGODB_URI: mongo.getUri("e2e"),
    BETTER_AUTH_SECRET: "e2e-only-value-e2e-only-value-e2e-only-value",
    BETTER_AUTH_URL: `http://localhost:${port}`,
    ADMIN_EMAILS: "",
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
