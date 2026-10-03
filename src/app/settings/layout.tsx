import Link from "next/link";

import { Masthead } from "@/components/masthead";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";
import { DASHBOARD_PATH } from "@/features/auth/paths";
import { SignOutButton } from "@/features/auth/sign-out-button";

export default function SettingsLayout({ children }: LayoutProps<"/settings">) {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Button asChild variant="ghost" size="sm">
          <Link href={DASHBOARD_PATH}>Dashboard</Link>
        </Button>
        <ThemeToggle />
        <SignOutButton />
      </Masthead>
      <main className="w-full flex-1 px-6 py-16 sm:px-10">{children}</main>
      <Toaster />
    </div>
  );
}
