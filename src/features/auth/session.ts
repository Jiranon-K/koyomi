import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";

import { getAuth } from "./auth";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "./paths";

// The authoritative guards. Call one at the top of every private page, Server Action and Route
// Handler; the proxy redirect is only a convenience and does not validate the session.

/** Returns the current session, or redirects an anonymous request to sign-in. */
export async function requireSession() {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect(SIGN_IN_PATH);
  return session;
}

/** Like `requireSession`, and answers a signed-in non-admin with a 404. */
export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") notFound();
  return session;
}

/** For the sign-in and sign-up pages: a visitor who already has a session goes to the dashboard. */
export async function redirectSignedIn(): Promise<void> {
  const auth = await getAuth();
  const session = await auth.api.getSession({ headers: await headers() });
  if (session) redirect(DASHBOARD_PATH);
}
