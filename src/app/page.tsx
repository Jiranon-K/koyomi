import Link from "next/link";

import { BRAND } from "@/components/brand";
import { Masthead } from "@/components/masthead";
import { Reveal } from "@/components/motion/reveal";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { HandwritingText } from "@/components/ui/handwriting-text";
import { SIGN_IN_PATH } from "@/features/auth/paths";

export default function Home() {
  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Button asChild variant="ghost" size="sm">
          <Link href={SIGN_IN_PATH}>Sign in</Link>
        </Button>
        <ThemeToggle />
      </Masthead>

      <main className="grid flex-1 lg:grid-cols-12">
        <section className="flex flex-col justify-center px-6 py-14 sm:px-10 lg:col-span-8 lg:py-24">
          <Reveal slideOnly>
            <h1 className="font-display text-[clamp(3.5rem,9.5vw,9.5rem)] leading-[0.92] tracking-tight">
              A calm place to <em className="text-primary">start</em> your next full-stack project.
            </h1>
          </Reveal>
        </section>
        <aside className="flex flex-col justify-between gap-16 bg-primary p-8 text-primary-foreground lg:col-span-4 lg:border-l lg:border-foreground">
          <Reveal inView>
            <p className="label-mono">Fig. 1 — the promise</p>
          </Reveal>
          <div>
            <HandwritingText
              words={["fast.", "full-stack.", "your way."]}
              fontUrl="/fonts/handwriting.ttf"
              height="5rem"
            />
            <Reveal inView>
              <p className="mt-6 max-w-xs text-lg">{BRAND.support}</p>
            </Reveal>
          </div>
        </aside>
      </main>
    </div>
  );
}
