"use client";

import { AnimatePresence } from "motion/react";
import * as m from "motion/react-m";

import { ARRIVE } from "./tokens";

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
