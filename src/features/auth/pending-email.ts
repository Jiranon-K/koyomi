const KEY = "auth:pending-email";

export function rememberPendingEmail(email: string): void {
  try {
    sessionStorage.setItem(KEY, email);
  } catch {}
}

export function readPendingEmail(): string {
  try {
    return sessionStorage.getItem(KEY) ?? "";
  } catch {
    return "";
  }
}
