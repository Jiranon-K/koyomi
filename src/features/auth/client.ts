import { createAuthClient } from "better-auth/client";

export const authClient = createAuthClient();

export const TOO_MANY_REQUESTS_MESSAGE = "Too many attempts. Please wait a little and try again.";
export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

export function networkError() {
  return { error: { status: 0, code: "NETWORK_ERROR" } };
}

export function errorMessage(error: { status: number }, fallback = GENERIC_ERROR_MESSAGE): string {
  return error.status === 429 ? TOO_MANY_REQUESTS_MESSAGE : fallback;
}
