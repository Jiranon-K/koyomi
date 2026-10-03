"use client";

import { useRouter } from "next/navigation";

import { TextLink } from "@/components/text-link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { signIn } from "./client";
import { FormError, FormField } from "./form-field";
import { PasswordField } from "./password-field";
import { FORGOT_PASSWORD_PATH, VERIFY_EMAIL_PATH } from "./paths";
import { signInSchema } from "./schema";
import { useAuthForm } from "./use-auth-form";

export function SignInForm({ returnTo }: { returnTo: string }) {
  const router = useRouter();
  const { errors, message, pending, onSubmit } = useAuthForm(signInSchema, async (data) => {
    const outcome = await signIn(data);
    if (outcome.kind === "error") return outcome.message;
    if (outcome.kind === "unverified") {
      router.push(VERIFY_EMAIL_PATH);
      return;
    }
    router.push(returnTo);
    router.refresh();
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
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
        autoComplete="current-password"
        required
        error={errors.password}
      />
      <div className="flex items-center justify-between text-sm">
        <Label htmlFor="rememberMe" className="font-normal text-muted-foreground">
          <Checkbox id="rememberMe" name="rememberMe" defaultChecked />
          Remember me
        </Label>
        <TextLink href={FORGOT_PASSWORD_PATH}>Forgot password?</TextLink>
      </div>
      <FormError message={message} />
      <Button type="submit" disabled={pending} aria-busy={pending} size="lg">
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
