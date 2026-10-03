import type { Metadata } from "next";

import { TextLink } from "@/components/text-link";
import { isLineLoginEnabled } from "@/features/auth/auth";
import { LineButton } from "@/features/auth/line-button";
import { lineSignInErrorMessage } from "@/features/auth/line-errors";
import { RETURN_PARAM, safeReturnPath, SIGN_UP_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { reset, error, [RETURN_PARAM]: next } = await searchParams;
  const returnTo = safeReturnPath(next);
  await redirectSignedIn(returnTo);
  // Only this boolean crosses to the browser; the channel id and secret stay on the server.
  const lineEnabled = isLineLoginEnabled();

  return (
    <>
      <h1 className="font-display text-5xl leading-none">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">
        Don&apos;t have an account? <TextLink href={SIGN_UP_PATH}>Sign up</TextLink>
      </p>
      <div className="mt-8 grid gap-5">
        {reset ? (
          <p className="text-sm text-muted-foreground">
            Your password was updated. Sign in with the new one.
          </p>
        ) : null}
        {lineEnabled && error ? (
          <p role="alert" className="text-sm text-destructive">
            {lineSignInErrorMessage(String(error))}
          </p>
        ) : null}
        <SignInForm returnTo={returnTo} />
        {lineEnabled ? <LineButton returnTo={returnTo} /> : null}
      </div>
    </>
  );
}
