"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient, networkError } from "./client";
import { focusFirstInvalid, FormError, FormField } from "./form-field";
import { VERIFY_EMAIL_PATH } from "./paths";
import { rememberPendingEmail } from "./pending-email";
import { fieldErrors, signUpSchema, type FieldErrors } from "./schema";

export function SignUpForm() {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsed = signUpSchema.safeParse(Object.fromEntries(new FormData(event.currentTarget)));
    setFormError(null);
    if (!parsed.success) {
      const invalid = fieldErrors(parsed.error);
      setErrors(invalid);
      focusFirstInvalid(event.currentTarget, invalid);
      return;
    }
    setErrors({});
    setPending(true);

    // The server answers an existing address exactly like a new one, so this never reveals it.
    const { error } = await authClient.signUp
      .email({ ...parsed.data, callbackURL: VERIFY_EMAIL_PATH })
      .catch(networkError);
    if (error) {
      setPending(false);
      setFormError("We could not create the account. Check the fields and try again.");
      return;
    }
    rememberPendingEmail(parsed.data.email);
    router.push(VERIFY_EMAIL_PATH);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField name="name" label="Name" autoComplete="name" required error={errors.name} />
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
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errors.password}
      />
      <FormError message={formError} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
