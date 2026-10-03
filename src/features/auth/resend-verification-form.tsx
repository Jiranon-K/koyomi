"use client";

import { useEffect, useRef } from "react";

import { Button } from "@/components/ui/button";

import { resendVerification } from "./client";
import { FormField, FormNotice } from "./form-field";
import { readPendingEmail } from "./pending-email";
import { emailSchema } from "./schema";
import { useAuthForm } from "./use-auth-form";

export function ResendVerificationForm() {
  const form = useRef<HTMLFormElement>(null);
  const { errors, message, pending, onSubmit } = useAuthForm(emailSchema, async ({ email }) => {
    const outcome = await resendVerification(email);
    return outcome.kind === "error"
      ? outcome.message
      : "If that address has an account waiting for verification, a new link is on its way.";
  });

  useEffect(() => {
    const input = form.current?.elements.namedItem("email");
    if (input instanceof HTMLInputElement && !input.value) input.value = readPendingEmail();
  }, []);

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
      <FormNotice message={message} />
      <Button type="submit" variant="outline" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Resend verification email"}
      </Button>
    </form>
  );
}
