import { getSessionCookie } from "better-auth/cookies";
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import { cache } from "react";

import { getAuth } from "./auth";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "./paths";

const getSession = cache(async () => {
  const requestHeaders = await headers();
  if (!getSessionCookie(requestHeaders)) return null;
  const auth = await getAuth();
  return auth.api.getSession({ headers: requestHeaders });
});

export async function requireSession() {
  const session = await getSession();
  if (!session) redirect(SIGN_IN_PATH);
  return session;
}

export async function requireAdmin() {
  const session = await requireSession();
  if (session.user.role !== "admin") notFound();
  return session;
}

export async function redirectSignedIn(): Promise<void> {
  const session = await getSession();
  if (session) redirect(DASHBOARD_PATH);
}
