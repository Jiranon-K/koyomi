import Link from "next/link";

import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { HandwritingText } from "@/components/ui/handwriting-text";

const stack = ["Next.js", "shadcn/ui", "Tailwind CSS", "MongoDB", "Zod", "Vitest"];

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-6 py-5">
        <span className="font-semibold tracking-tight">nextjs-fullstack</span>
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center gap-8 px-6 pb-24 text-center">
        <h1 className="max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-6xl">
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
          The Task example shows every layer working end to end.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/tasks">Try the Task example</Link>
          </Button>
        </div>

        <ul className="flex flex-wrap items-center justify-center gap-2 text-sm text-muted-foreground">
          {stack.map((item) => (
            <li key={item} className="rounded-full border bg-card px-3 py-1">
              {item}
            </li>
          ))}
        </ul>
      </main>
    </div>
  );
}
