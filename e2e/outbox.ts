import { readFile } from "node:fs/promises";

const LOG = ".e2e/server.log";

export async function emailedLink(to: string, subject: string): Promise<string> {
  const header = `[email] to=${to} subject="${subject}"`;
  for (let attempt = 0; attempt < 50; attempt++) {
    const lines = (await readFile(LOG, "utf8")).split(/\r?\n/);
    const at = lines.lastIndexOf(header);
    const url = at === -1 ? undefined : lines[at + 1]?.match(/^\[email\] (http\S+)$/)?.[1];
    if (url) return url;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error(`No "${subject}" email to ${to} in ${LOG}`);
}
