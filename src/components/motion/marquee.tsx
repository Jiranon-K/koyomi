import { cn } from "cn";

import { MARQUEE_SECONDS } from "./tokens";

const FEWEST = 8;

function Run({ items }: { items: readonly string[] }) {
  return (
    <span className="flex shrink-0 items-baseline">
      {items.map((item, index) => (
        <span key={index} className="flex items-baseline whitespace-nowrap">
          <span className="px-6">{item}</span>
          <span className="text-primary">／</span>
        </span>
      ))}
    </span>
  );
}

export function Marquee({ items, className }: { items: readonly string[]; className?: string }) {
  if (items.length === 0) return null;
  const run = Array.from({ length: Math.ceil(FEWEST / items.length) }, () => items).flat();
  const seconds = Math.max(MARQUEE_SECONDS.least, run.length * MARQUEE_SECONDS.perItem);

  return (
    <div aria-hidden className={cn("overflow-hidden", className)}>
      <p
        data-arrive
        className="flex w-max animate-[marquee_linear_infinite] hover:[animation-play-state:paused]"
        style={{ animationDuration: `${seconds}s` }}
      >
        <Run items={run} />
        <Run items={run} />
      </p>
    </div>
  );
}
