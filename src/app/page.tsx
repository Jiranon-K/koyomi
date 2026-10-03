import Link from "next/link";

import { Button } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/features/auth/paths";
import { ThemeToggle } from "@/components/theme-toggle";
import { HandwritingText } from "@/components/ui/handwriting-text";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-end gap-2 px-6 py-5">
        <Button asChild variant="ghost" size="sm">
          <Link href={SIGN_IN_PATH}>Sign in</Link>
        </Button>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-24 text-center">
        <h1 className="max-w-2xl text-4xl leading-tight font-bold tracking-tight sm:text-6xl">
          Start your next idea
          <br />
          <HandwritingText
            words={["fast.", "full-stack.", "your way."]}
            fontUrl="/fonts/handwriting.ttf"
            className="text-chart-1 dark:text-chart-2"
            height="1.15em"
          />
        </h1>

        <p className="max-w-xl text-muted-foreground">
          A clean template with a Next.js App Router, shadcn/ui and MongoDB already wired together.
        </p>
      </main>
    </div>
  );
}
