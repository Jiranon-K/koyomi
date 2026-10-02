"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient, networkError, TOO_MANY_REQUESTS_MESSAGE } from "./client";
import { focusFirstInvalid, FormError, FormField } from "./form-field";
import { DASHBOARD_PATH, VERIFY_EMAIL_PATH } from "./paths";
import { rememberPendingEmail } from "./pending-email";
import { fieldErrors, signInSchema, type FieldErrors } from "./schema";

export function SignInForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsed = signInSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    setFormError(null);
    if (!parsed.success) {
      const invalid = fieldErrors(parsed.error);
      setErrors(invalid);
      focusFirstInvalid(event.currentTarget, invalid);
      return;
    }
    setErrors({});
    setPending(true);

    const { error } = await authClient.signIn.email(parsed.data).catch(networkError);
    if (!error) {
      router.push(DASHBOARD_PATH);
      router.refresh();
      return;
    }

    // Only sent after the password matched, so it does not reveal anything to a stranger.
    if (error.code === "EMAIL_NOT_VERIFIED") {
      rememberPendingEmail(parsed.data.email);
      router.push(VERIFY_EMAIL_PATH);
      return;
    }
    setPending(false);
    setFormError(
      error.status === 401
        ? "Invalid email or password."
        : error.status === 429
          ? TOO_MANY_REQUESTS_MESSAGE
          : "Something went wrong. Please try again.",
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
      <FormField
        name="password"
        label="Password"
        type="password"
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <FormError message={formError} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
