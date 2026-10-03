import Link from "next/link";

import { BRAND } from "@/components/brand";
import { Masthead } from "@/components/masthead";
import { Reveal } from "@/components/motion/reveal";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { HandwritingText } from "@/components/ui/handwriting-text";
import { SIGN_IN_PATH, SIGN_UP_PATH } from "@/features/auth/paths";

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
              Every airing anime, on <em className="text-primary">Thai</em> time.
            </h1>
            <p className="mt-8 max-w-xl text-lg text-muted-foreground">
              Koyomi is an airing tracker for the current anime season. Follow the shows you watch
              and it converts each Japanese broadcast to Thai time for you.
            </p>
            <div className="mt-10">
              <Button asChild size="lg">
                <Link href={SIGN_UP_PATH}>Create account</Link>
              </Button>
            </div>
          </Reveal>
        </section>
        <aside className="flex flex-col justify-between gap-16 bg-primary p-8 text-primary-foreground lg:col-span-4 lg:border-l lg:border-foreground">
          <Reveal inView>
            <p className="label-mono">Fig. 1 — the reminder</p>
          </Reveal>
          <div>
            <HandwritingText
              words={["tonight.", "on LINE.", "at 09:00."]}
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
