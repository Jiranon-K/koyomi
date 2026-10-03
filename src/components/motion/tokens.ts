const DURATION = { arrive: 0.4, micro: 0.2 } as const;
const EASE: [number, number, number, number] = [0.22, 1, 0.36, 1];
const EASE_IN_OUT: [number, number, number, number] = [0.76, 0, 0.24, 1];

export const TRAVEL = 12;
export const STAGGER = 0.06;
export const PRESS_SCALE = 0.98;

export const ARRIVE = { duration: DURATION.arrive, ease: EASE } as const;
export const MICRO = { duration: DURATION.micro, ease: EASE } as const;

export const HIDDEN = { opacity: 0, y: TRAVEL } as const;
export const SHOWN = { opacity: 1, y: 0 } as const;

export const IN_VIEW = { once: true } as const;

export const UNVEIL = { duration: 0.9, ease: EASE } as const;
export const WIPE = { duration: 0.9, ease: EASE_IN_OUT } as const;
export const SWAP = { duration: 0.6, ease: EASE_IN_OUT } as const;
export const SETTLE = { duration: 1.6, ease: EASE } as const;
export const ZOOM = 1.18;
export const NUDGE = 12;

export const MARQUEE_SECONDS = { perItem: 8, least: 24 } as const;
