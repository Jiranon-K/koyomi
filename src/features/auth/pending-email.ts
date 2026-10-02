// Carries the address from sign-up or sign-in to the verify-email notice without putting it in the URL.
const KEY = "auth:pending-email";

export function rememberPendingEmail(email: string): void {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {
    // Storage can be blocked; the notice then just starts with an empty field.
  }
}

export function readPendingEmail(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
