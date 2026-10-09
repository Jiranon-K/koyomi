import {
  createQStashQueue,
  jobUrl,
  publicOriginProblem,
} from "../src/features/notifications/queue";
import { appUrl, qstashEnv } from "../src/lib/env";

const print = (line: string) => process.stdout.write(`${line}\n`);

/* digest-send needs a user and a day, so it is only ever enqueued by digest-fanout. */
const PUBLISHABLE = ["sync-schedule", "digest-fanout"] as const;
const job = PUBLISHABLE.find((name) => name === process.argv[2]);

if (!job) {
  print(`Usage: bun scripts/publish-job.ts <${PUBLISHABLE.join("|")}>`);
  process.exit(1);
}

const origin = appUrl();
const problem = publicOriginProblem(origin);
if (problem) {
  print(problem);
  process.exit(1);
}

const { token, url } = qstashEnv();
await createQStashQueue({ token, url, appUrl: origin }).enqueue(job, {});
print(`Published ${job} to QStash for ${jobUrl(origin, job)}.`);
