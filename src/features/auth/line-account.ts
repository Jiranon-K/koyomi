import { isAPIError } from "better-auth/api";

import { LINE_PROVIDER_ID, type Auth } from "./auth";
import { SETTINGS_PATH } from "./paths";

/**
 * Connecting and disconnecting LINE for the signed-in user. Better Auth endpoint names, error
 * codes and the callback paths of these two flows are named only here and in `line-errors.ts`.
 */

/**
 * The LINE address to send the signed-in user to so that they can connect their LINE account.
 * Setting the OAuth state cookie is left to Better Auth (the `nextCookies` plugin), so call this
 * from a Server Action. `bot_prompt=aggressive` makes LINE show its add-friend screen for the bot
 * after the user consents.
 */
export async function lineConnectUrl(auth: Auth, requestHeaders: Headers): Promise<string> {
  const { url } = await auth.api.linkSocialAccount({
    headers: requestHeaders,
    body: {
      provider: LINE_PROVIDER_ID,
      callbackURL: SETTINGS_PATH,
      errorCallbackURL: SETTINGS_PATH,
      disableRedirect: true,
      additionalParams: { bot_prompt: "aggressive" },
    },
  });
  return url;
}

export type DisconnectLineOutcome =
  | { kind: "ok" }
  /** LINE is the only way into this account, so removing it would lock the user out. */
  | { kind: "only-sign-in-method" }
  /** The session is too old for a sensitive change; the user has to sign in again. */
  | { kind: "stale-session" }
  | { kind: "error" };

function errorCode(error: unknown): string | undefined {
  return isAPIError(error) ? error.body?.code : undefined;
}

/** Remove every LINE account from the signed-in user. Already having none counts as done. */
export async function disconnectLine(
  auth: Auth,
  requestHeaders: Headers,
): Promise<DisconnectLineOutcome> {
  try {
    const accounts = await auth.api.listUserAccounts({ headers: requestHeaders });
    for (const account of accounts) {
      if (account.providerId !== LINE_PROVIDER_ID) continue;
      await auth.api.unlinkAccount({ headers: requestHeaders, body: { accountId: account.id } });
    }
    return { kind: "ok" };
  } catch (error) {
    const code = errorCode(error);
    if (code === "FAILED_TO_UNLINK_LAST_ACCOUNT") return { kind: "only-sign-in-method" };
    if (code === "SESSION_NOT_FRESH") return { kind: "stale-session" };
    console.error("[auth] could not disconnect LINE", error);
    return { kind: "error" };
  }
}
