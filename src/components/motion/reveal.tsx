"use client";

import * as m from "motion/react-m";

import { ARRIVE, HIDDEN, IN_VIEW, SHOWN } from "./tokens";

type RevealProps = {
  children: React.ReactNode;
  className?: string;
  /** Slide only and keep full opacity, for content that must be visible from first paint. */
  slideOnly?: boolean;
  /** Play when the block enters the viewport (once) instead of on mount. */
  inView?: boolean;
};

export function Reveal({ children, className, slideOnly = false, inView = false }: RevealProps) {
  return (
    <m.div
      data-arrive
      className={className}
      initial={slideOnly ? { ...HIDDEN, opacity: 1 } : HIDDEN}
      {...(inView ? { whileInView: SHOWN, viewport: IN_VIEW } : { animate: SHOWN })}
      transition={ARRIVE}
    >
      {children}
    </m.div>
  );
}
