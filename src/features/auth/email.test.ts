import { describe, expect, it } from "vitest";

import { emailLog, linkInEmailLog, type EmailMessage } from "./email";

const verify: EmailMessage = {
  to: "ada@example.com",
  kind: "verify-email",
  subject: "Verify your email",
  url: "http://localhost:3000/api/auth/verify-email?token=first&callbackURL=%2Fverify-email",
};

describe("linkInEmailLog", () => {
  it("finds the link of a logged email by recipient and subject", () => {
    expect(linkInEmailLog(emailLog(verify), verify.to, verify.subject)).toBe(verify.url);
  });

  it("returns the most recent link when the same email was sent twice", () => {
    const resent = { ...verify, url: verify.url.replace("first", "second") };
    const log = [emailLog(verify), emailLog(resent)].join("\n");

    expect(linkInEmailLog(log, verify.to, verify.subject)).toBe(resent.url);
  });

  it("does not match an email to another recipient", () => {
    expect(linkInEmailLog(emailLog(verify), "bob@example.com", verify.subject)).toBeUndefined();
  });

  it("does not match an email with another subject", () => {
    expect(linkInEmailLog(emailLog(verify), verify.to, "Reset your password")).toBeUndefined();
  });

  it("tolerates unrelated server output and Windows line endings", () => {
    const log = ["▲ Next.js", emailLog(verify), " GET /sign-up 200", ""].join("\n");

    expect(linkInEmailLog(log.replaceAll("\n", "\r\n"), verify.to, verify.subject)).toBe(
      verify.url,
    );
  });

  it("finds nothing while the link line has not been written yet", () => {
    const [header] = emailLog(verify).split("\n");

    expect(linkInEmailLog(header ?? "", verify.to, verify.subject)).toBeUndefined();
  });

  it("finds nothing when the line after the header is not a clean link", () => {
    const log = `${emailLog(verify)} trailing text`;

    expect(linkInEmailLog(log, verify.to, verify.subject)).toBeUndefined();
  });
});
