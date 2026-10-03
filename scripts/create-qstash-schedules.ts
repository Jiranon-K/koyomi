// Creates (or updates) the three QStash schedules that drive the background work: the schedule
// sync every six hours, the sync at 08:45 and the digest at 09:00 Bangkok time.
//
//   bun scripts/create-qstash-schedules.ts            create or update the schedules
//   bun scripts/create-qstash-schedules.ts --dry-run  print what would be created, call nothing
//
// Needs QSTASH_TOKEN and BETTER_AUTH_URL (bun reads .env.local); QSTASH_URL when the QStash
// account is not in the default region. BETTER_AUTH_URL must be the deployed, public origin: QStash
// calls it from the internet. Safe to run again: each schedule has a fixed id, so a second run
// overwrites the first instead of adding copies. It prints no token.
import { Client } from "@upstash/qstash";

import { jobUrl } from "../src/features/notifications/queue";
import { JOB_SCHEDULES } from "../src/features/notifications/schedules";
import { appUrl, qstashEnv } from "../src/lib/env";

const print = (line: string) => process.stdout.write(`${line}\n`);

const dryRun = process.argv.includes("--dry-run");
const origin = appUrl();
const { hostname, protocol } = new URL(origin);

if (protocol !== "https:" || ["localhost", "127.0.0.1", "[::1]"].includes(hostname)) {
  print(
    `BETTER_AUTH_URL is ${origin}: QStash cannot reach it. Run this with the deployed HTTPS origin.`,
  );
  if (!dryRun) process.exit(1);
}

if (dryRun) {
  for (const { scheduleId, job, cron } of JOB_SCHEDULES) {
    print(`${scheduleId}: ${cron} -> POST ${jobUrl(origin, job)}`);
  }
  process.exit(0);
}

const { token, url } = qstashEnv();
const client = new Client({ token, baseUrl: url, devMode: false, enableTelemetry: false });

for (const { scheduleId, job, cron, retries } of JOB_SCHEDULES) {
  const destination = jobUrl(origin, job);
  await client.schedules.create({ scheduleId, destination, cron, retries, method: "POST" });
  print(`${scheduleId}: ${cron} -> POST ${destination}`);
}

const existing = await client.schedules.list();
const ours = new Set(JOB_SCHEDULES.map(({ scheduleId }) => scheduleId));
const others = existing.filter(({ scheduleId }) => !ours.has(scheduleId));
print(`QStash now holds ${existing.length} schedule(s).`);
for (const { scheduleId, cron, destination } of others) {
  print(`Not created by this script, left alone: ${scheduleId} (${cron} -> ${destination})`);
}
