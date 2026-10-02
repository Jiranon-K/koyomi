import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGN_IN_PATH } from "@/features/auth/paths";
import { ResendVerificationForm } from "@/features/auth/resend-verification-form";
import { redirectSignedIn } from "@/features/auth/session";
import { TextLink } from "@/features/auth/text-link";

export const metadata: Metadata = { title: "Verify your email" };

// Also the landing spot of the emailed link: a valid link signs the user in (so they are sent on to
// the dashboard), an invalid or expired one arrives here with `?error=`, and one that was already
// used arrives with neither a session nor an error.
export default async function VerifyEmailPage({ searchParams }: PageProps<"/verify-email">) {
  await redirectSignedIn();
  const { error } = await searchParams;

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>{error ? "That link did not work" : "Verify your email"}</h1>
        </CardTitle>
        <CardDescription>
          {error
            ? "The verification link is invalid or has expired. Request a new one below."
            : "Open the verification link we emailed when you signed up and you will be signed in. If you already used it, sign in below. If it is missing or expired, request a new one."}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ResendVerificationForm />
        <p className="text-sm text-muted-foreground">
          Already verified? <TextLink href={SIGN_IN_PATH}>Sign in</TextLink>
        </p>
      </CardContent>
    </Card>
  );
}
