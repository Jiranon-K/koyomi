"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { ARRIVE } from "./tokens";

/**
 * Wrap an inline error or status notice. It fades in and unfolds its height, and folds away when
 * `children` becomes empty. Put the live region (`role="alert"` or `role="status"`) outside this
 * wrapper, so it stays mounted and a screen reader announces text that appears inside it; a notice
 * that is itself mounted only when shown can keep its own role inside.
 */
export function PresenceMessage({ children }: { children?: React.ReactNode }) {
  return (
    <AnimatePresence initial={false}>
      {children ? (
        <m.div
          key="message"
          data-arrive
          style={{ overflow: "hidden" }}
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
          transition={ARRIVE}
        >
          {children}
        </m.div>
      ) : null}
    </AnimatePresence>
  );
}
