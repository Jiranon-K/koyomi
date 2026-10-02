import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { isGoogleEnabled } from "@/features/auth/auth";
import { GoogleButton } from "@/features/auth/google-button";
import { FORGOT_PASSWORD_PATH, SIGN_UP_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignInForm } from "@/features/auth/sign-in-form";
import { TextLink } from "@/features/auth/text-link";

export const metadata: Metadata = { title: "Sign in" };

// Callback errors meaning the address is unproven: Google did not verify it, or an account for it
// exists here that was never verified (so it cannot be linked).
const NEEDS_VERIFICATION_ERRORS = ["email_not_verified", "account_not_linked"];

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  await redirectSignedIn();
  // `error` is set when a Google sign-in comes back unsuccessful (cancelled, or refused by the app).
  const { reset, error } = await searchParams;
  const googleEnabled = isGoogleEnabled();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>
          {reset
            ? "Your password was updated. Sign in with the new one."
            : "Welcome back. Enter your email and password."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        {googleEnabled && error ? (
          <p role="alert" className="text-sm text-destructive">
            {NEEDS_VERIFICATION_ERRORS.includes(String(error))
              ? "Google sign-in needs a verified email. Check your inbox for a verification link, then try again."
              : "Google sign-in did not complete. Please try again."}
          </p>
        ) : null}
        <SignInForm />
        {googleEnabled ? <GoogleButton /> : null}
        <p className="text-sm text-muted-foreground">
          <TextLink href={FORGOT_PASSWORD_PATH}>Forgot password?</TextLink>
        </p>
        <p className="text-sm text-muted-foreground">
          No account yet? <TextLink href={SIGN_UP_PATH}>Create one</TextLink>
        </p>
      </CardContent>
    </Card>
  );
}
