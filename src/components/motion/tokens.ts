// The single source of motion feel. Quiet and printed-magazine: ease-out, no spring, no overshoot.
const DURATION = { arrive: 0.4, micro: 0.2 } as const;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const TRAVEL = 12;
export const STAGGER = 0.06;
export const PRESS_SCALE = 0.98;

export const ARRIVE = { duration: DURATION.arrive, ease: EASE } as const;
export const MICRO = { duration: DURATION.micro, ease: EASE } as const;

// Every wrapper element carries `data-arrive`: globals.css targets it to show the final state at once
// under reduced motion. Keep the attribute and that rule in step.
//
// An arrival slides up 12px while fading in; the two states every reveal moves between.
export const HIDDEN = { opacity: 0, y: TRAVEL } as const;
export const SHOWN = { opacity: 1, y: 0 } as const;

// An in-view arrival plays once, as soon as any part of the block is on screen. No inset margin: a
// block sitting in the last stretch of a page that cannot scroll further would never trigger.
export const IN_VIEW = { once: true } as const;
