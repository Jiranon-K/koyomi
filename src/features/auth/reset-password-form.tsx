"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { authClient, errorMessage, networkError } from "./client";
import { FormError, FormField } from "./form-field";
import { FORGOT_PASSWORD_PATH, SIGN_IN_PATH } from "./paths";
import { PASSWORD_HINT, resetPasswordSchema } from "./schema";
import { TextLink } from "./text-link";
import { useAuthForm } from "./use-auth-form";

const LINK_EXPIRED_MESSAGE = (
  <>
    This reset link has expired or was already used.{" "}
    <TextLink href={FORGOT_PASSWORD_PATH}>Request a new link</TextLink>
  </>
);

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter();
  const { errors, message, pending, onSubmit } = useAuthForm(
    resetPasswordSchema,
    async ({ password }) => {
      const { error } = await authClient
        .resetPassword({ newPassword: password, token })
        .catch(networkError);
      if (error) {
        return error.code === "INVALID_TOKEN" ? LINK_EXPIRED_MESSAGE : errorMessage(error);
      }
      router.replace(`${SIGN_IN_PATH}?reset=done`);
    },
  );

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-4">
      <FormField
        name="password"
        label="New password"
        type="password"
        autoComplete="new-password"
        required
        hint={PASSWORD_HINT}
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
      <FormError message={message} />
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Saving…" : "Set new password"}
      </Button>
    </form>
  );
}
