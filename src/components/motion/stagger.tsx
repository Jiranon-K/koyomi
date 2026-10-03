"use client";

import * as m from "motion/react-m";

import { ARRIVE, HIDDEN, SHOWN, STAGGER } from "./tokens";

type StaggerProps = { children: React.ReactNode; className?: string };

const container = { hidden: {}, shown: { transition: { staggerChildren: STAGGER } } };
const item = { hidden: HIDDEN, shown: { ...SHOWN, transition: ARRIVE } };

export function Stagger({ children, className }: StaggerProps) {
  return (
    <m.div className={className} variants={container} initial="hidden" animate="shown">
      {children}
    </m.div>
  );
}

export function StaggerItem({ children, className }: StaggerProps) {
  return (
    <m.div data-arrive className={className} variants={item}>
      {children}
    </m.div>
  );
}
