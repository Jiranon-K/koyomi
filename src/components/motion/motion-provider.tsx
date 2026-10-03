"use client";

import { LazyMotion, MotionConfig, domAnimation } from "motion/react";

// Mounted once in the root layout. `m` components load their features lazily, and every
// transform is skipped when the visitor's system asks for reduced motion.
export function MotionProvider({ children }: { children: React.ReactNode }) {
  return (
    <LazyMotion features={domAnimation} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
