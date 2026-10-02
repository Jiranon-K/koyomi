import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";

import { SIGN_IN_PATH } from "@/features/auth/paths";

// Optimistic only: it checks that a session cookie exists, not that it is valid, and Server Actions
// on unmatched routes never pass through here. `requireSession()` in the page is the real guard.
export function proxy(request: NextRequest) {
  if (!getSessionCookie(request)) {
    return NextResponse.redirect(new URL(SIGN_IN_PATH, request.url));
  }
  return NextResponse.next();
}

// Must be a literal for static analysis; keep in step with DASHBOARD_PATH.
export const config = {
  matcher: ["/dashboard/:path*"],
};
