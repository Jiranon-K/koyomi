import type { Metadata } from "next";

import { requireSession } from "@/features/auth/session";

export const metadata: Metadata = { title: "Dashboard" };

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[6rem_1fr] gap-4 border-b border-border py-4">
      <dt className="label-mono text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function DashboardPage() {
  const { user } = await requireSession();

  return (
    <>
      <h1 className="font-display text-5xl leading-none">Dashboard</h1>
      <p className="mt-2 text-muted-foreground">You are signed in.</p>
      <dl className="mt-10 max-w-md border-t border-foreground">
        <Row label="Email">
          <span className="break-all">{user.email}</span>
        </Row>
        <Row label="Role">{user.role === "admin" ? "Admin" : "User"}</Row>
      </dl>
    </>
  );
}
