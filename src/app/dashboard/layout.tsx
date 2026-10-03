import Link from "next/link";

import { Masthead } from "@/components/masthead";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "@/features/auth/sign-out-button";
import { SCHEDULE_PATH } from "@/features/schedule/paths";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Button asChild variant="ghost" size="sm">
          <Link href={SCHEDULE_PATH}>Schedule</Link>
        </Button>
        <ThemeToggle />
        <SignOutButton />
      </Masthead>
      <main className="w-full flex-1 px-6 py-16 sm:px-10">{children}</main>
      <Toaster />
    </div>
  );
}
