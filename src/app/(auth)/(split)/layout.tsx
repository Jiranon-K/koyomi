import { ArrowLeft } from "lucide-react";
import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";

export default function SplitAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-primary p-10 text-primary-foreground lg:flex">
        <div
          aria-hidden="true"
          className="absolute -right-24 -bottom-24 size-96 rounded-full border border-primary-foreground/15"
        />
        <div
          aria-hidden="true"
          className="absolute -right-8 -bottom-40 size-96 rounded-full border border-primary-foreground/15"
        />
        <Link
          href="/"
          aria-label="Back to home"
          className="relative flex size-10 items-center justify-center rounded-full bg-primary-foreground/10 outline-none hover:bg-primary-foreground/20 focus-visible:ring-3 focus-visible:ring-primary-foreground/50"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="relative my-auto max-w-md">
          <p className="text-4xl leading-tight font-semibold text-balance">
            A calm place to start your next full-stack project.
          </p>
          <p className="mt-4 text-sm text-primary-foreground/70">
            Next.js, MongoDB and authentication, already wired together.
          </p>
        </div>
      </aside>

      <div className="flex flex-col">
        <header className="flex items-center justify-between px-6 py-5">
          <Link
            href="/"
            className="rounded-sm text-sm font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50 lg:invisible"
          >
            Home
          </Link>
          <ThemeToggle />
        </header>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 pb-16">
          {children}
        </main>
      </div>
    </div>
  );
}
