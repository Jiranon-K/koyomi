export type EmailMessage = {
  to: string;
  kind: "verify-email" | "reset-password";
  subject: string;
  url: string;
};

export type SendEmail = (message: EmailMessage) => Promise<void>;

const PREFIX = "[email]";

function header(to: string, subject: string): string {
  return `${PREFIX} to=${to} subject="${subject}"`;
}

function linkLine(url: string): string {
  return `${PREFIX} ${url}`;
}

export function emailLog(message: EmailMessage): string {
  return `${header(message.to, message.subject)}\n${linkLine(message.url)}`;
}

export function linkInEmailLog(log: string, to: string, subject: string): string | undefined {
  const lines = log.split(/\r?\n/);
  const at = lines.lastIndexOf(header(to, subject));
  const line = at === -1 ? undefined : lines[at + 1];
  const url = line?.slice(linkLine("").length);
  return url && /^http\S+$/.test(url) && line === linkLine(url) ? url : undefined;
}

export const sendEmail: SendEmail = async (message) => {
  console.log(emailLog(message));
};
