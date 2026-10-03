"use client";

import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";

import { signUp } from "./client";
import { FormError, FormField } from "./form-field";
import { PasswordField } from "./password-field";
import { VERIFY_EMAIL_PATH } from "./paths";
import { PASSWORD_HINT, signUpSchema } from "./schema";
import { useAuthForm } from "./use-auth-form";

export function SignUpForm() {
  const router = useRouter();
  const { errors, message, pending, onSubmit } = useAuthForm(signUpSchema, async (data) => {
    const outcome = await signUp(data);
    if (outcome.kind === "error") return outcome.message;
    router.push(VERIFY_EMAIL_PATH);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField name="name" label="Name" autoComplete="name" required error={errors.name} />
      <FormField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        error={errors.email}
      />
      <PasswordField
        name="password"
        label="Password"
        autoComplete="new-password"
        required
        hint={PASSWORD_HINT}
        error={errors.password}
      />
      <FormError message={message} />
      <Button type="submit" disabled={pending} aria-busy={pending} size="lg">
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
