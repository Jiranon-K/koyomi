import { createAuthClient } from "better-auth/react";

// No baseURL: the client talks to /api/auth on the origin that served the page.
export const authClient = createAuthClient();

export const TOO_MANY_REQUESTS_MESSAGE = "Too many attempts. Please wait a little and try again.";

/** Stand-in result for a request that never reached the server, so forms can leave their pending state. */
export function networkError() {
  return { error: { status: 0, code: "NETWORK_ERROR" } };
}
