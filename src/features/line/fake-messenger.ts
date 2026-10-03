import type { LineMessenger } from "./messenger";

// The fake LINE sender: it writes each message to the server log instead of sending it, so the
// end-to-end tests can read what was "sent" (`e2e/outbox.ts`). This file owns the format of that
// line and its reader; change the two together.

export type LoggedPush = { to: string; retryKey: string; text: string };

const PREFIX = "[line] push ";

/** One log line per message; the text is JSON-encoded so a multi-line message stays on one line. */
export function lineLog(message: LoggedPush): string {
  return `${PREFIX}${JSON.stringify(message)}`;
}

function parse(line: string): LoggedPush | undefined {
  if (!line.startsWith(PREFIX)) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(line.slice(PREFIX.length));
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  if (!("to" in value) || !("retryKey" in value) || !("text" in value)) return undefined;
  const { to, retryKey, text } = value;
  return typeof to === "string" && typeof retryKey === "string" && typeof text === "string"
    ? { to, retryKey, text }
    : undefined;
}

/** Every message the log says was pushed to `lineUserId`, oldest first. */
export function pushesInLineLog(log: string, lineUserId: string): LoggedPush[] {
  return log.split(/\r?\n/).flatMap((line) => {
    const push = parse(line);
    return push?.to === lineUserId ? [push] : [];
  });
}

export function createFakeMessenger(): LineMessenger {
  return {
    name: "fake",
    async push(lineUserId, text, retryKey) {
      console.log(lineLog({ to: lineUserId, retryKey, text }));
      return { ok: true };
    },
  };
}
