// The single source of motion feel. Quiet and printed-magazine: ease-out, no spring, no overshoot.
const DURATION = { arrive: 0.4, micro: 0.2 } as const;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const TRAVEL = 12;
export const STAGGER = 0.06;
export const PRESS_SCALE = 0.98;

export const ARRIVE = { duration: DURATION.arrive, ease: EASE } as const;
export const MICRO = { duration: DURATION.micro, ease: EASE } as const;

// An arrival slides up 12px while fading in; the two states every reveal moves between.
export const HIDDEN = { opacity: 0, y: TRAVEL } as const;
export const SHOWN = { opacity: 1, y: 0 } as const;

// Start an in-view arrival a little before the block is fully on screen, and only once.
export const IN_VIEW = { once: true, margin: "0px 0px -10% 0px" } as const;
