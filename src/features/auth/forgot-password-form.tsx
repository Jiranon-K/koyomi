"use client";

import { Button } from "@/components/ui/button";

import { requestPasswordReset } from "./client";
import { FormField, FormNotice } from "./form-field";
import { emailSchema } from "./schema";
import { useAuthForm } from "./use-auth-form";

export function ForgotPasswordForm() {
  const { errors, message, pending, onSubmit } = useAuthForm(emailSchema, async ({ email }) => {
    const outcome = await requestPasswordReset(email);
    return outcome.kind === "error"
      ? outcome.message
      : "If that address has an account, a reset link is on its way. It works once and expires in 1 hour.";
  });

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
      <FormNotice message={message} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Sending…" : "Send reset link"}
      </Button>
    </form>
  );
}
