import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FORGOT_PASSWORD_PATH, SIGN_UP_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignInForm } from "@/features/auth/sign-in-form";
import { TextLink } from "@/features/auth/text-link";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: PageProps<"/sign-in">) {
  await redirectSignedIn();
  const { reset } = await searchParams;

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
        <SignInForm />
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
