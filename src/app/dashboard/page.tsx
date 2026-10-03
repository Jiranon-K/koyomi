import type { Metadata } from "next";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireSession } from "@/features/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const { user } = await requireSession();

  return (
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
  );
}
