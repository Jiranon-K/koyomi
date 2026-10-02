import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FORGOT_PASSWORD_PATH } from "@/features/auth/paths";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";
import { TextLink } from "@/features/auth/text-link";

export const metadata: Metadata = {
  title: "Reset password",
  // The token is in the URL; keep it out of Referer headers sent to other origins.
  referrer: "no-referrer",
};

// The emailed link goes through the auth API first, which forwards here with `?token=` when the
// token is still good and with `?error=` when it is unknown, expired or already used.
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
