"use client";

import { useState } from "react";

import { signInWithLine } from "./client";
import { FormError } from "./form-field";
import { LineLoginButton } from "./line-login-button";

export function LineButton({ returnTo }: { returnTo?: string }) {
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onClick() {
    if (pending) return;
    setFormError(null);
    setPending(true);

    const outcome = await signInWithLine(returnTo);
    if (outcome.kind === "error") {
      setPending(false);
      setFormError(outcome.message);
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
      <LineLoginButton pending={pending} onClick={onClick} />
    </div>
  );
}
