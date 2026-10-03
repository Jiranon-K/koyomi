import { isAPIError } from "better-auth/api";

import { LINE_PROVIDER_ID, type Auth } from "./auth";
import { SETTINGS_PATH } from "./paths";

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
  { kind: "ok" } | { kind: "only-sign-in-method" } | { kind: "stale-session" } | { kind: "error" };

function errorCode(error: unknown): string | undefined {
  return isAPIError(error) ? error.body?.code : undefined;
}

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
