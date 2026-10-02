"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient, networkError } from "./client";
import { focusFirstInvalid, FormField } from "./form-field";
import { RESET_PASSWORD_PATH } from "./paths";
import { emailSchema, fieldErrors, type FieldErrors } from "./schema";

export function ForgotPasswordForm() {
  const [errors, setErrors] = useState<FieldErrors>({});
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

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

    // Without `redirectTo` the emailed link has nowhere to land and ends on an error page.
    const { error } = await authClient
      .requestPasswordReset({ email: parsed.data.email, redirectTo: RESET_PASSWORD_PATH })
      .catch(networkError);
    setPending(false);
    // Same wording whether or not the address has an account.
    setNotice(
      error
        ? "Something went wrong. Please try again."
        : "If that address has an account, a reset link is on its way. It works once and expires in 1 hour.",
    );
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
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
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
