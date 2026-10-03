import { readFile } from "node:fs/promises";

import { linkInEmailLog } from "../src/features/auth/email";
import { pushesInLineLog, type LoggedPush } from "../src/features/line/fake-messenger";

const LOG = ".e2e/server.log";

export async function emailedLink(to: string, subject: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const url = linkInEmailLog(await readFile(LOG, "utf8"), to, subject);
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No "${subject}" email to ${to} in ${LOG}`);
}

/**
 * The LINE messages the fake sender "pushed" to a LINE user, oldest first. Waits until there are at
 * least `atLeast` of them (the server log is written a moment after the request returns), then
 * returns whatever is there, so a caller can also assert that there are no more than that.
 */
export async function linePushes(lineUserId: string, atLeast = 0): Promise<LoggedPush[]> {
  let pushes: LoggedPush[] = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    pushes = pushesInLineLog(await readFile(LOG, "utf8"), lineUserId);
    if (pushes.length >= atLeast) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return pushes;
}
