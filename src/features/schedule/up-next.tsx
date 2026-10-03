import { dayWindowOf, formatAirTime, formatUntil, formatWeekday } from "./day-window";
import { episodeLabel } from "./episode-label";
import type { WallEntry } from "./wall";

type UpNextProps = { entry: WallEntry; now: Date; today: string; action?: React.ReactNode };

export function UpNext({ entry, now, today, action }: UpNextProps) {
  const airAt = new Date(entry.airAt);
  const day = dayWindowOf(airAt).day;

  return (
    <div role="group" aria-labelledby="up-next" className="mt-8 border-t border-foreground pt-4">
      <p className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 label-mono">
        <span id="up-next" className="bg-primary px-1.5 py-0.5 text-primary-foreground">
          Up next
        </span>
        <span className="flex gap-3 text-muted-foreground">
          {day === today ? null : <span>{formatWeekday(day)}</span>}
          <span>{formatUntil(airAt, now)}</span>
        </span>
      </p>
      <p className="mt-4 flex flex-wrap items-baseline gap-x-6 gap-y-2">
        <time
          dateTime={entry.airAt}
          className="font-mono text-4xl leading-none tabular-nums sm:text-5xl"
        >
          {formatAirTime(airAt)}
        </time>
        <span className="font-display text-3xl leading-tight">{entry.title}</span>
      </p>
      <div className="mt-4 flex items-center gap-4">
        <span className="text-sm text-muted-foreground">{episodeLabel(entry)}</span>
        {action}
      </div>
    </div>
  );
}
