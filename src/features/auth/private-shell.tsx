import Link from "next/link";

import { Masthead } from "@/components/masthead";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Toaster } from "@/components/ui/sonner";

import { SignOutButton } from "./sign-out-button";

type NavLink = { href: React.ComponentProps<typeof Link>["href"]; label: string };

export function PrivateShell({
  links,
  children,
}: {
  links: readonly NavLink[];
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        {links.map(({ href, label }) => (
          <Button key={label} asChild variant="ghost" size="sm">
            <Link href={href}>{label}</Link>
          </Button>
        ))}
        <ThemeToggle />
        <SignOutButton />
      </Masthead>
      <main className="w-full flex-1 px-6 py-16 sm:px-10">{children}</main>
      <Toaster />
    </div>
  );
}
