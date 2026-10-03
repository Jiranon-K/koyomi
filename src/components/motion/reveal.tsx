"use client";

import * as m from "motion/react-m";

import { ARRIVE, HIDDEN, IN_VIEW, SHOWN } from "./tokens";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  slideOnly?: boolean;
  inView?: boolean;
  delay?: number;
};

export function Reveal({
  children,
  className,
  slideOnly = false,
  inView = false,
  delay = 0,
}: RevealProps) {
  return (
    <m.div
      data-arrive
      className={className}
      initial={slideOnly ? { ...HIDDEN, opacity: 1 } : HIDDEN}
      {...(inView ? { whileInView: SHOWN, viewport: IN_VIEW } : { animate: SHOWN })}
      transition={{ ...ARRIVE, delay }}
    >
      {children}
    </m.div>
  );
}
