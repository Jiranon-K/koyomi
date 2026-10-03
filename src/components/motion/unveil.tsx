"use client";

import { cn } from "cn";
import * as m from "motion/react-m";

import { IN_VIEW, SETTLE, UNVEIL, WIPE, ZOOM } from "./tokens";

type UnveilProps = {
  children?: React.ReactNode;
  className?: string;
  delay?: number;
  inView?: boolean;
};

function trigger(inView: boolean) {
  return inView
    ? ({ initial: "hidden", whileInView: "shown", viewport: IN_VIEW } as const)
    : ({ initial: "hidden", animate: "shown" } as const);
}

export function LineReveal({ children, className, delay = 0, inView = false }: UnveilProps) {
  return (
    <m.span className={cn("block overflow-hidden pb-[0.12em]", className)} {...trigger(inView)}>
      <m.span
        data-arrive
        className="block"
        variants={{ hidden: { y: "115%" }, shown: { y: "0%" } }}
        transition={{ ...UNVEIL, delay }}
      >
        {children}
      </m.span>
    </m.span>
  );
}

export function Curtain({ children, className, delay = 0, inView = false }: UnveilProps) {
  return (
    <m.div className={cn("relative overflow-hidden", className)} {...trigger(inView)}>
      <m.div
        data-arrive
        className="absolute inset-0"
        variants={{ hidden: { scale: ZOOM }, shown: { scale: 1 } }}
        transition={{ ...SETTLE, delay }}
      >
        {children}
      </m.div>
      <m.span
        data-curtain
        aria-hidden
        className="absolute inset-0 bg-primary"
        variants={{ hidden: { x: "0%" }, shown: { x: "101%" } }}
        transition={{ ...WIPE, delay }}
      />
    </m.div>
  );
}

export function MaskReveal({ children, className, delay = 0, inView = false }: UnveilProps) {
  return (
    <m.div className={cn("relative", className)} {...trigger(inView)}>
      <m.div
        data-arrive
        className="absolute inset-0"
        variants={{
          hidden: { clipPath: "inset(100% 0% 0% 0%)" },
          shown: { clipPath: "inset(0% 0% 0% 0%)" },
        }}
        transition={{ ...WIPE, delay }}
      >
        {children}
      </m.div>
    </m.div>
  );
}

export function RuleDraw({ className, delay = 0, inView = false }: UnveilProps) {
  return (
    <m.span aria-hidden className={cn("block", className)} {...trigger(inView)}>
      <m.span
        data-arrive
        className="block h-px origin-left bg-foreground"
        variants={{ hidden: { scaleX: 0 }, shown: { scaleX: 1 } }}
        transition={{ ...WIPE, delay }}
      />
    </m.span>
  );
}
