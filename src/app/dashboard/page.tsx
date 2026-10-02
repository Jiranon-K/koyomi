import type { Metadata } from "next";

import { ThemeToggle } from "@/components/theme-toggle";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  // The proxy only checks that a cookie exists; this is the real check.
  const { user } = await requireSession();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-end gap-2 px-6 py-5">
        <ThemeToggle />
        <SignOutButton />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>
              <h1>Dashboard</h1>
            </CardTitle>
            <CardDescription>You are signed in.</CardDescription>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2">
              <dt className="text-muted-foreground">Email</dt>
              <dd className="break-all">{user.email}</dd>
              <dt className="text-muted-foreground">Role</dt>
              <dd>{user.role === "admin" ? "Admin" : "User"}</dd>
            </dl>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
