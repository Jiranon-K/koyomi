import type { Metadata } from "next";

import { TextLink } from "@/components/text-link";
import { isLineLoginEnabled } from "@/features/auth/auth";
import { LineButton } from "@/features/auth/line-button";
import { SIGN_IN_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignUpForm } from "@/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  await redirectSignedIn();

  return (
    <>
      <h1 className="font-display text-5xl leading-none">Create your account</h1>
      <p className="mt-2 text-muted-foreground">
        Already have an account? <TextLink href={SIGN_IN_PATH}>Sign in</TextLink>
      </p>
      <div className="mt-8 grid gap-5">
        <p className="text-sm text-muted-foreground">
          We will email you a link to verify your address.
        </p>
        <SignUpForm />
        {isLineLoginEnabled() ? <LineButton /> : null}
      </div>
    </>
  );
}
