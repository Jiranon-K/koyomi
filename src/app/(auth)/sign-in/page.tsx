import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGN_UP_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignInForm } from "@/features/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage() {
  await redirectSignedIn();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Sign in</h1>
        </CardTitle>
        <CardDescription>Welcome back. Enter your email and password.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SignInForm />
        <p className="text-sm text-muted-foreground">
          No account yet?{" "}
          <Link href={SIGN_UP_PATH} className="font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Create one
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
