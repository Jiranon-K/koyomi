import type { Metadata } from "next";
import Link from "next/link";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { SIGN_IN_PATH } from "@/features/auth/paths";
import { redirectSignedIn } from "@/features/auth/session";
import { SignUpForm } from "@/features/auth/sign-up-form";

export const metadata: Metadata = { title: "Create account" };

export default async function SignUpPage() {
  await redirectSignedIn();

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Create account</h1>
        </CardTitle>
        <CardDescription>We will email you a link to verify your address.</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <SignUpForm />
        <p className="text-sm text-muted-foreground">
          Already have an account?{" "}
          <Link href={SIGN_IN_PATH} className="font-medium text-foreground underline underline-offset-4 outline-none focus-visible:ring-3 focus-visible:ring-ring/50">
            Sign in
          </Link>
        </p>
      </CardContent>
    </Card>
  );
}
