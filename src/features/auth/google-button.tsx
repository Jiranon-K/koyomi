"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient, networkError, TOO_MANY_REQUESTS_MESSAGE } from "./client";
import { FormError } from "./form-field";
import { DASHBOARD_PATH, SIGN_IN_PATH } from "./paths";

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
    <div className="grid gap-4">
      <div className="flex items-center gap-3 text-xs text-muted-foreground" aria-hidden="true">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>
      <FormError message={formError} />
      <Button type="button" variant="outline" onClick={signIn} disabled={pending} aria-busy={pending}>
        {pending ? "Redirecting to Google…" : "Continue with Google"}
      </Button>
    </div>
  );
}
