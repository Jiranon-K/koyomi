"use client";

import { useEffect, useRef, useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient, networkError } from "./client";
import { focusFirstInvalid, FormField } from "./form-field";
import { VERIFY_EMAIL_PATH } from "./paths";
import { readPendingEmail } from "./pending-email";
import { emailSchema, fieldErrors, type FieldErrors } from "./schema";

export function ResendVerificationForm() {
  const form = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  // Prefill after hydration: sessionStorage does not exist during server rendering.
  useEffect(() => {
    const input = form.current?.elements.namedItem("email");
    if (input instanceof HTMLInputElement && !input.value) input.value = readPendingEmail();
  }, []);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsed = emailSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    setNotice(null);
    if (!parsed.success) {
      const invalid = fieldErrors(parsed.error);
      setErrors(invalid);
      focusFirstInvalid(event.currentTarget, invalid);
      return;
    }
    setErrors({});
    setPending(true);

    const { error } = await authClient
      .sendVerificationEmail({ email: parsed.data.email, callbackURL: VERIFY_EMAIL_PATH })
      .catch(networkError);
    setPending(false);
    // Same wording whether or not the address has an account waiting.
    setNotice(
      error
        ? "Something went wrong. Please try again."
        : "If that address has an account waiting for verification, a new link is on its way.",
    );
  }

  return (
    <form ref={form} onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField
        name="email"
        label="Email"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <p role="status" className="text-sm text-muted-foreground empty:sr-only">
        {notice}
      </p>
      <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
    </form>
  );
}
