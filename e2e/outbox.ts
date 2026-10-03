import { readFile } from "node:fs/promises";

import { linkInEmailLog } from "../src/features/auth/email";

const LOG = ".e2e/server.log";

export async function emailedLink(to: string, subject: string): Promise<string> {
  for (let attempt = 0; attempt < 50; attempt++) {
    const url = linkInEmailLog(await readFile(LOG, "utf8"), to, subject);
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No "${subject}" email to ${to} in ${LOG}`);
}
