import { describe, expect, it } from "vitest";

import {
  lineConnectErrorMessage,
  lineDisconnectErrorMessage,
  lineSignInErrorMessage,
} from "./line-errors";

describe("lineSignInErrorMessage", () => {
  it("tells a visitor with an unverified LINE email to use the emailed link", () => {
    expect(lineSignInErrorMessage("email_not_verified")).toMatch(/verified email/);
  });

  it("sends the owner of an existing account to their password and to Settings", () => {
    expect(lineSignInErrorMessage("account_not_linked")).toMatch(/password.*Settings/);
  });

  it("explains that no account was created when LINE shared no email", () => {
    expect(lineSignInErrorMessage("email_not_found")).toMatch(/did not share an email/);
  });

  it.each(["access_denied", "", "constructor", "<script>alert(1)</script>"])(
    "falls back to a fixed message for %j and never echoes the code",
    (code) => {
      expect(lineSignInErrorMessage(code)).toBe("LINE sign-in did not complete. Please try again.");
    },
  );
});

describe("lineConnectErrorMessage", () => {
  it("explains that the LINE account belongs to another account", () => {
    expect(lineConnectErrorMessage("account_already_linked_to_different_user")).toMatch(
      /already connected to another/,
    );
  });

  it("falls back to a fixed message for anything else", () => {
    expect(lineConnectErrorMessage("toString")).toBe(
      "LINE could not be connected. Please try again.",
    );
  });
});

describe("lineDisconnectErrorMessage", () => {
  it("has a different message for each reason", () => {
    const messages = (["only-sign-in-method", "stale-session", "error"] as const).map((kind) =>
      lineDisconnectErrorMessage({ kind }),
    );

    expect(new Set(messages).size).toBe(3);
    expect(messages[0]).toMatch(/only way to sign in/);
    expect(messages[1]).toMatch(/sign in again/);
  });
});
