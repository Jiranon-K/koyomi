import type { DisconnectLineOutcome } from "./line-account";

const SIGN_IN_ERRORS: Record<string, string> = {
  email_not_verified:
    "LINE sign-in needs a verified email. We sent a link to the address LINE shared; open it, then continue with LINE again.",
  account_not_linked:
    "An account with that email already exists. Sign in with your password, then connect LINE in Settings.",
  email_not_found:
    "LINE did not share an email address, so no account was created. Create an account with your email, then connect LINE in Settings.",
};

const CONNECT_ERRORS: Record<string, string> = {
  account_already_linked_to_different_user:
    "That LINE account is already connected to another Koyomi account.",
};

function lookUp(messages: Record<string, string>, code: string): string | undefined {
  return Object.hasOwn(messages, code) ? messages[code] : undefined;
}

export function lineSignInErrorMessage(code: string): string {
  return lookUp(SIGN_IN_ERRORS, code) ?? "LINE sign-in did not complete. Please try again.";
}

export function lineConnectErrorMessage(code: string): string {
  return lookUp(CONNECT_ERRORS, code) ?? "LINE could not be connected. Please try again.";
}

export function lineDisconnectErrorMessage(
  outcome: Exclude<DisconnectLineOutcome, { kind: "ok" }>,
): string {
  switch (outcome.kind) {
    case "only-sign-in-method":
      return "LINE is the only way to sign in to this account, so it cannot be disconnected.";
    case "stale-session":
      return "For your security, sign out and sign in again before disconnecting LINE.";
    case "error":
      return "LINE could not be disconnected. Please try again.";
  }
}
