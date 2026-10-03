"use client";

import { Button } from "@/components/ui/button";

import { authClient, errorMessage, networkError } from "./client";
import { FormField, FormNotice } from "./form-field";
import { RESET_PASSWORD_PATH } from "./paths";
import { emailSchema } from "./schema";
import { useAuthForm } from "./use-auth-form";

export function ForgotPasswordForm() {
  const { errors, message, pending, onSubmit } = useAuthForm(emailSchema, async ({ email }) => {
    const { error } = await authClient
      .requestPasswordReset({ email, redirectTo: RESET_PASSWORD_PATH })
      .catch(networkError);
    return error
      ? errorMessage(error)
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
