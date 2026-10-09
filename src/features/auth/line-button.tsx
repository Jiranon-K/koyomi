"use client";

import { useState } from "react";

import { signInWithLine } from "./client";
import { FormError } from "./form-field";

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
      <button
        type="button"
        data-line-login
        onClick={onClick}
        disabled={pending}
        aria-busy={pending}
        className="group flex h-11 w-full bg-line-button text-base leading-none font-bold text-line-button-foreground outline-none hover:bg-line-button-hover focus-visible:ring-3 focus-visible:ring-ring/50 active:bg-line-button-press disabled:pointer-events-none disabled:bg-line-button-disabled disabled:text-line-button-disabled-foreground disabled:inset-ring disabled:inset-ring-line-button-disabled-rule"
      >
        <span data-line-icon aria-hidden="true" className="size-11 shrink-0 line-login-icon" />
        <span
          data-line-label
          className="flex flex-1 items-center justify-center border-l border-line-button-rule px-8 whitespace-nowrap group-disabled:border-line-button-disabled-rule"
        >
          Log in with LINE
        </span>
      </button>
    </div>
  );
}
