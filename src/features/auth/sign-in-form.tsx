"use client";

import { cn } from "cn";
import { useRouter } from "next/navigation";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

import { authClient, errorMessage, networkError } from "./client";
import { FormError, FormField, LARGE_CONTROL } from "./form-field";
import { PasswordField } from "./password-field";
import { DASHBOARD_PATH, FORGOT_PASSWORD_PATH, VERIFY_EMAIL_PATH } from "./paths";
import { rememberPendingEmail } from "./pending-email";
import { signInSchema } from "./schema";
import { TextLink } from "./text-link";
import { useAuthForm } from "./use-auth-form";

export function SignInForm() {
  const router = useRouter();
  const { errors, message, pending, onSubmit } = useAuthForm(signInSchema, async (data) => {
    const { error } = await authClient.signIn.email(data).catch(networkError);
    if (!error) {
      router.push(DASHBOARD_PATH);
      router.refresh();
      return;
    }
    if (error.code === "EMAIL_NOT_VERIFIED") {
      rememberPendingEmail(data.email);
      router.push(VERIFY_EMAIL_PATH);
      return;
    }
    return error.status === 401 ? "Invalid email or password." : errorMessage(error);
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-5">
      <FormField
        name="email"
        label="Email address"
        type="email"
        autoComplete="email"
        required
        large
        error={errors.email}
      />
      <PasswordField
        name="password"
        label="Password"
        autoComplete="current-password"
        required
        large
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
      <Button
        type="submit"
        disabled={pending}
        aria-busy={pending}
        className={cn(LARGE_CONTROL, "text-base")}
      >
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
