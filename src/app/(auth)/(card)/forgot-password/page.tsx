import type { Metadata } from "next";

import { TextLink } from "@/components/text-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";
import { SIGN_IN_PATH } from "@/features/auth/paths";

export const metadata: Metadata = { title: "Forgot password" };

export default function ForgotPasswordPage() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Forgot password</h1>
        </CardTitle>
        <CardDescription>
          Enter your email and we will send you a link to choose a new one.
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4">
        <ForgotPasswordForm />
        <p className="text-sm text-muted-foreground">
          Remembered it? <TextLink href={SIGN_IN_PATH}>Sign in</TextLink>
        </p>
      </CardContent>
    </Card>
  );
}
