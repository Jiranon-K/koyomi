// Records one real timetable response as the sample the source-mapping test should read, and
// prints what ticket 02 still needs: the shape of the delay fields and the rate-limit headers.
//
//   bun scripts/record-animeschedule-sample.ts
//
// Needs ANIMESCHEDULE_TOKEN (bun reads .env.local). It makes ONE request. The file it writes is
// public schedule data and holds no token.
import { writeFile } from "node:fs/promises";

import { isoWeekOf, parseTimetable } from "../src/features/schedule/animeschedule";
import { scheduleEnv } from "../src/lib/env";

const print = (line: string) => process.stdout.write(`${line}\n`);

const OUT = "src/features/schedule/fixtures/timetable.recorded.json";

const { year, week } = isoWeekOf(new Date());
const url = `https://animeschedule.net/api/v3/timetables/raw?year=${year}&week=${week}`;
const response = await fetch(url, {
  headers: { authorization: `Bearer ${scheduleEnv().ANIMESCHEDULE_TOKEN}` },
});

print(`GET ${url} -> ${response.status}`);
for (const header of ["x-ratelimit-limit", "x-ratelimit-remaining", "x-ratelimit-reset"]) {
  print(`${header}: ${response.headers.get(header) ?? "(absent)"}`);
}
if (!response.ok) process.exit(1);

const body: unknown = await response.json();
await writeFile(OUT, `${JSON.stringify(body, null, 2)}\n`);

const { episodes, skipped } = parseTimetable(body);
const delayed = episodes.filter((episode) => episode.delayed);
print(`${episodes.length} episodes mapped, ${skipped} skipped, ${delayed.length} delayed.`);
print(`Wrote ${OUT}`);

if (Array.isArray(body)) {
  const raw: unknown = body.find(
    (entry: unknown) =>
      typeof entry === "object" &&
      entry !== null &&
      "airingStatus" in entry &&
      entry.airingStatus === "delayed-air",
  );
  print(
    `A raw entry with airingStatus delayed-air: ${raw ? JSON.stringify(raw, null, 2) : "(none this week)"}`,
  );
}
