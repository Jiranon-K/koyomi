import type { Metadata } from "next";

import { TextLink } from "@/components/text-link";
import { isGoogleEnabled } from "@/features/auth/auth";
import { GoogleButton } from "@/features/auth/google-button";
import { SIGN_IN_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignUpForm } from "@/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  await redirectSignedIn();

  return (
    <>
      <h1 className="text-3xl font-semibold">Create your account</h1>
      <p className="mt-2 text-muted-foreground">
        Already have an account? <TextLink href={SIGN_IN_PATH}>Sign in</TextLink>
      </p>
      <div className="mt-8 grid gap-5">
        <p className="text-sm text-muted-foreground">
          We will email you a link to verify your address.
        </p>
        <SignUpForm />
        {isGoogleEnabled() ? <GoogleButton /> : null}
      </div>
    </>
  );
}
