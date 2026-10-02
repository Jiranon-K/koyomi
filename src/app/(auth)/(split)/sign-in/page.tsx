import type { Metadata } from "next";

import { isGoogleEnabled } from "@/features/auth/auth";
import { GoogleButton } from "@/features/auth/google-button";
import { SIGN_UP_PATH } from "@/features/auth/paths";
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
    <>
      <h1 className="text-3xl font-semibold">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">
        Don&apos;t have an account? <TextLink href={SIGN_UP_PATH}>Sign up</TextLink>
      </p>
      <div className="mt-8 grid gap-5">
        {reset ? (
          <p className="text-sm text-muted-foreground">
            Your password was updated. Sign in with the new one.
          </p>
        ) : null}
        {googleEnabled && error ? (
          <p role="alert" className="text-sm text-destructive">
            {NEEDS_VERIFICATION_ERRORS.includes(String(error))
              ? "Google sign-in needs a verified email. Check your inbox for a verification link, then try again."
              : "Google sign-in did not complete. Please try again."}
          </p>
        ) : null}
        <SignInForm />
        {googleEnabled ? <GoogleButton /> : null}
      </div>
    </>
  );
}
