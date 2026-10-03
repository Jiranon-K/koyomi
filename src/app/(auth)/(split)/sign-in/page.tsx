import type { Metadata } from "next";

import { TextLink } from "@/components/text-link";
import { RETURN_PARAM, safeReturnPath, SIGN_UP_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  const { reset, [RETURN_PARAM]: next } = await searchParams;
  const returnTo = safeReturnPath(next);
  await redirectSignedIn(returnTo);

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
        <SignInForm returnTo={returnTo} />
      </div>
    </>
  );
}
