"use client";

import { cn } from "cn";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient, networkError, TOO_MANY_REQUESTS_MESSAGE } from "./client";
import { FormError, LARGE_CONTROL } from "./form-field";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "./paths";

// The Google mark keeps its brand colours: the one exception to semantic theme classes.
function GoogleMark() {
  return (
    <svg className="size-4" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

/** Rendered only when the server says Google is configured; it also covers sign-up. */
export function GoogleButton() {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function signIn() {
    if (pending) return;
    setFormError(null);
    setPending(true);

    // On success the browser leaves for Google, so the pending state is left on.
    const { error } = await authClient.signIn
      .social({ provider: "google", callbackURL: DASHBOARD_PATH, errorCallbackURL: SIGN_IN_PATH })
      .catch(networkError);
    if (error) {
      setPending(false);
      setFormError(
        error.status === 429 ? TOO_MANY_REQUESTS_MESSAGE : "Something went wrong. Please try again.",
      );
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <FormError message={formError} />
      <Button
        type="button"
        variant="outline"
        onClick={signIn}
        disabled={pending}
        aria-busy={pending}
        className={cn(LARGE_CONTROL, "gap-2")}
      >
        <GoogleMark />
        {pending ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
    </div>
  );
}
