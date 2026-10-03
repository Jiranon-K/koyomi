import type { Metadata } from "next";

import { TextLink } from "@/components/text-link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FORGOT_PASSWORD_PATH } from "@/features/auth/paths";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export const metadata: Metadata = {
  title: "Reset password",
  referrer: "no-referrer",
};

export default async function ResetPasswordPage({ searchParams }: PageProps<"/reset-password">) {
  const { token } = await searchParams;

  if (typeof token !== "string" || !token) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>
            <h1>That link did not work</h1>
          </CardTitle>
          <CardDescription>
            This reset link is invalid, has expired or was already used. Reset links work once and
            expire after 1 hour.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            <TextLink href={FORGOT_PASSWORD_PATH}>Request a new link</TextLink>
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h1>Choose a new password</h1>
        </CardTitle>
        <CardDescription>
          You will be signed out everywhere and can then sign in with the new password.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ResetPasswordForm token={token} />
      </CardContent>
    </Card>
  );
}
