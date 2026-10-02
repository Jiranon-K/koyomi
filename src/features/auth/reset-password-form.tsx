"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";

import { authClient, networkError } from "./client";
import { focusFirstInvalid, FormError, FormField } from "./form-field";
import { FORGOT_PASSWORD_PATH, SIGN_IN_PATH } from "./paths";
import { fieldErrors, resetPasswordSchema, type FieldErrors } from "./schema";
import { TextLink } from "./text-link";

const FAILURE_MESSAGES = {
  linkExpired: (
    <>
      This reset link has expired or was already used.{" "}
      <TextLink href={FORGOT_PASSWORD_PATH}>Request a new link</TextLink>
    </>
  ),
  unknown: "Something went wrong. Please try again.",
};

type Failure = keyof typeof FAILURE_MESSAGES;

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const [errors, setErrors] = useState<FieldErrors>({});
  const [failure, setFailure] = useState<Failure | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: React.SubmitEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;

    const parsed = resetPasswordSchema.safeParse(
      Object.fromEntries(new FormData(event.currentTarget)),
    );
    setFailure(null);
    if (!parsed.success) {
      const invalid = fieldErrors(parsed.error);
      setErrors(invalid);
      focusFirstInvalid(event.currentTarget, invalid);
      return;
    }
    setErrors({});
    setPending(true);

    const { error } = await authClient
      .resetPassword({ newPassword: parsed.data.password, token })
      .catch(networkError);
    if (error) {
      setPending(false);
      // The link can expire or be used in another tab between opening this page and submitting.
      setFailure(error.code === "INVALID_TOKEN" ? "linkExpired" : "unknown");
      return;
    }
    // Replace, so Back does not return to a URL holding the spent token.
    router.replace(`${SIGN_IN_PATH}?reset=done`);
  }

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        hint="At least 8 characters."
        error={errors.password}
      />
      <FormField
        name="confirmPassword"
        label="Confirm new password"
        type="password"
        autoComplete="new-password"
        required
        error={errors.confirmPassword}
      />
      <FormError message={failure ? FAILURE_MESSAGES[failure] : null} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
