import { Masthead } from "@/components/masthead";
import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "@/features/auth/sign-out-button";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <ThemeToggle />
        <SignOutButton />
      </Masthead>
      <main className="w-full flex-1 px-6 py-16 sm:px-10">{children}</main>
      <Toaster />
    </div>
  );
}
