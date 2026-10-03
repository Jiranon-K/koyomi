export const SIGN_IN_PATH = "/sign-in";
export const SIGN_UP_PATH = "/sign-up";
export const VERIFY_EMAIL_PATH = "/verify-email";
export const FORGOT_PASSWORD_PATH = "/forgot-password";
export const RESET_PASSWORD_PATH = "/reset-password";
export const DASHBOARD_PATH = "/dashboard";

export const RETURN_PARAM = "next";

const ORIGIN = "http://return.invalid";

export function safeReturnPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.includes("\\")) {
    return DASHBOARD_PATH;
  }
  const url = URL.parse(value, ORIGIN);
  if (!url || url.origin !== ORIGIN || url.pathname.startsWith("//")) return DASHBOARD_PATH;
  return `${url.pathname}${url.search}${url.hash}`;
}

export function signInPathReturningTo(path: string): string {
  return `${SIGN_IN_PATH}?${new URLSearchParams({ [RETURN_PARAM]: path }).toString()}`;
}

export const SETTINGS_PATH = "/settings";
export const ADMIN_PATH = "/admin";
