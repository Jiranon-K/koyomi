import type { LineMessenger } from "./messenger";

// The fake LINE sender: it writes each message to the server log instead of sending it, so the
// end-to-end tests can read what was "sent" (`e2e/outbox.ts`). This file owns the format of those
// lines and their readers; change them together. A push and a reply are different lines, so a
// reader of one never sees the other.

export type LoggedPush = { to: string; retryKey: string; text: string };
export type LoggedReply = { replyToken: string; text: string };

const PUSH_PREFIX = "[line] push ";
const REPLY_PREFIX = "[line] reply ";

/** One log line per push; the text is JSON-encoded so a multi-line message stays on one line. */
export function lineLog(message: LoggedPush): string {
  return `${PUSH_PREFIX}${JSON.stringify(message)}`;
}

/** One log line per reply, encoded like a push. */
export function replyLog(reply: LoggedReply): string {
  return `${REPLY_PREFIX}${JSON.stringify(reply)}`;
}

// The fields of the JSON object after `prefix` on a log line, if the line is one of ours.
function fieldsAfter(line: string, prefix: string): Map<string, unknown> | undefined {
  if (!line.startsWith(prefix)) return undefined;
  let value: unknown;
  try {
    value = JSON.parse(line.slice(prefix.length));
  } catch {
    return undefined;
  }
  if (typeof value !== "object" || value === null) return undefined;
  return new Map<string, unknown>(Object.entries(value));
}

function parsePush(line: string): LoggedPush | undefined {
  const fields = fieldsAfter(line, PUSH_PREFIX);
  const [to, retryKey, text] = [fields?.get("to"), fields?.get("retryKey"), fields?.get("text")];
  return typeof to === "string" && typeof retryKey === "string" && typeof text === "string"
    ? { to, retryKey, text }
    : undefined;
}

function parseReply(line: string): LoggedReply | undefined {
  const fields = fieldsAfter(line, REPLY_PREFIX);
  const [replyToken, text] = [fields?.get("replyToken"), fields?.get("text")];
  return typeof replyToken === "string" && typeof text === "string"
    ? { replyToken, text }
    : undefined;
}

/** Every message the log says was pushed to `lineUserId`, oldest first. */
export function pushesInLineLog(log: string, lineUserId: string): LoggedPush[] {
  return log.split(/\r?\n/).flatMap((line) => {
    const push = parsePush(line);
    return push?.to === lineUserId ? [push] : [];
  });
}

/** Every reply the log records, oldest first. */
export function repliesInLineLog(log: string): LoggedReply[] {
  return log.split(/\r?\n/).flatMap((line) => {
    const reply = parseReply(line);
    return reply ? [reply] : [];
  });
}

export function createFakeMessenger(): LineMessenger {
  return {
    name: "fake",
    async push(lineUserId, text, retryKey) {
      console.log(lineLog({ to: lineUserId, retryKey, text }));
      return { ok: true };
    },
    async reply(replyToken, text) {
      console.log(replyLog({ replyToken, text }));
      return { ok: true };
    },
  };
}
