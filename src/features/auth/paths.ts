export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const VERIFY_EMAIL_PATH = "/verify-email";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const DASHBOARD_PATH = "/dashboard";

/** The sign-in query parameter that names where to go afterwards. */
export const RETURN_PARAM = "next";

// A base that no real link points at: whatever resolves to another origin was not a local path.
const ORIGIN = "http://return.invalid";

/**
 * Where to send someone after sign-in. The value comes from the URL, so it is only honoured when it
 * is a path on this site; anything else (another origin, `//host`, a backslash trick, a scheme)
 * falls back to the dashboard. This is the guard against open redirects: use it on every read.
 */
export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\")) {
    return DASHBOARD_PATH;
  }
  const url = URL.parse(value, ORIGIN);
  // The parser drops tabs and dot segments, so check what it produced, not what was typed.
  if (!url || url.origin !== ORIGIN || url.pathname.startsWith("//")) return DASHBOARD_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

/** The sign-in page, returning to `path` once signed in. */
export function signInPathReturningTo(path: string): string {
  return `${SIGN_IN_PATH}?${new URLSearchParams({ [RETURN_PARAM]: path }).toString()}`;
}
