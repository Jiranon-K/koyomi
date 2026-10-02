import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <Link
          href="/"
          className="rounded-sm text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
        >
          Home
        </Link>
        <ThemeToggle />
      </header>
      <main className="mx-auto flex w-full max-w-sm flex-1 flex-col justify-center px-6 pb-24">
        {children}
      </main>
    </div>
  );
}
