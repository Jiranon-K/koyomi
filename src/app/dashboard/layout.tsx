import Link from "next/link";

import { Masthead } from "@/components/masthead";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { ADMIN_PATH, SETTINGS_PATH } from "@/features/auth/paths";
import { currentSession } from "@/features/auth/session";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { SCHEDULE_PATH } from "@/features/schedule/paths";

export default async function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  // Only decides whether the link is shown; `/admin` guards itself.
  const isAdmin = (await currentSession())?.user.role === "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Button asChild variant="ghost" size="sm">
          <Link href={SCHEDULE_PATH}>Schedule</Link>
        </Button>
        <Button asChild variant="ghost" size="sm">
          <Link href={SETTINGS_PATH}>Settings</Link>
        </Button>
        {isAdmin ? (
          <Button asChild variant="ghost" size="sm">
            <Link href={ADMIN_PATH}>Admin</Link>
          </Button>
        ) : null}
        <ThemeToggle />
        <SignOutButton />
      </Masthead>
      <main className="w-full flex-1 px-6 py-16 sm:px-10">{children}</main>
      <Toaster />
    </div>
  );
}
