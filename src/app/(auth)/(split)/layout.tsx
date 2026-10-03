import { ArrowLeft } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { BRAND } from "@/components/brand";
import { Masthead } from "@/components/masthead";
import { Reveal } from "@/components/motion/reveal";
import { Curtain, LineReveal } from "@/components/motion/unveil";
import { ThemeToggle } from "@/components/theme-toggle";

export default function SplitAuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <aside className="relative isolate hidden flex-col justify-between overflow-hidden bg-scrim p-10 text-scrim-foreground lg:flex">
        <Curtain className="absolute inset-0 -z-10">
          <Image
            src="/images/auth-poster.jpg"
            alt=""
            fill
            sizes="(min-width: 1024px) 50vw, 1px"
            className="scale-110 object-cover blur-sm"
          />
          <div
            aria-hidden
            className="absolute inset-0 bg-linear-to-t from-scrim via-scrim/60 to-scrim/45"
          />
        </Curtain>
        <div>
          <Link
            href="/"
            aria-label="Back to home"
            className="flex size-10 items-center justify-center border border-scrim-foreground/40 outline-none hover:bg-scrim-foreground/10 focus-visible:ring-3 focus-visible:ring-scrim-foreground/50"
          >
            <ArrowLeft className="size-5" />
          </Link>
        </div>
        <div className="max-w-md">
          <p className="font-display text-6xl leading-none text-balance">
            <LineReveal delay={0.4}>{BRAND.line}</LineReveal>
          </p>
          <Reveal delay={0.7}>
            <p className="mt-6 text-lg">{BRAND.support}</p>
          </Reveal>
        </div>
      </aside>

      <div className="flex flex-col">
        <Masthead>
          <ThemeToggle />
        </Masthead>
        <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-6 py-16">
          <Reveal>{children}</Reveal>
        </main>
      </div>
    </div>
  );
}
