import { readFile } from "node:fs/promises";

import { linkInEmailLog } from "../src/features/auth/email";
import { pushesInLineLog, type LoggedPush } from "../src/features/line/fake-messenger";

const MAIN_DIR = ".e2e";

export async function emailedLink(to: string, subject: string, dir = MAIN_DIR): Promise<string> {
  const log = `${dir}/server.log`;
  for (let attempt = 0; attempt < 50; attempt++) {
    const url = linkInEmailLog(await readFile(log, "utf8"), to, subject);
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No "${subject}" email to ${to} in ${log}`);
}

export async function linePushes(lineUserId: string, atLeast = 0): Promise<LoggedPush[]> {
  let pushes: LoggedPush[] = [];
  for (let attempt = 0; attempt < 50; attempt++) {
    pushes = pushesInLineLog(await readFile(`${MAIN_DIR}/server.log`, "utf8"), lineUserId);
    if (pushes.length >= atLeast) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  return pushes;
}
