import { ThemeToggle } from "@/components/theme-toggle";
import { Toaster } from "@/components/ui/sonner";
import { SignOutButton } from "@/features/auth/sign-out-button";

export default function DashboardLayout({ children }: LayoutProps<"/dashboard">) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-end gap-2 px-6 py-5">
        <ThemeToggle />
        <SignOutButton />
      </header>
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 pb-24">{children}</main>
      <Toaster />
    </div>
  );
}
