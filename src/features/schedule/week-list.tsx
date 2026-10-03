import { Stagger, StaggerItem } from "@/components/motion/stagger";

import { dayWindowOf, formatAirTime, formatDayDate, formatWeekday } from "./day-window";
import type { ScheduleDay, ScheduleEntry } from "./service";

function episodeLabel(entry: ScheduleEntry): string {
  return entry.firstEpisodeNumber === null
    ? `Episode ${entry.episodeNumber}`
    : `Episodes ${entry.firstEpisodeNumber}–${entry.episodeNumber}`;
}

function EntryRow({ entry, action }: { entry: ScheduleEntry; action?: React.ReactNode }) {
  return (
    <li className="grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 border-b border-border py-3">
      <time
        dateTime={entry.airAt}
        className={
          entry.delayed
            ? "font-mono text-sm text-muted-foreground tabular-nums line-through"
            : "font-mono text-sm tabular-nums"
        }
      >
        {formatAirTime(new Date(entry.airAt))}
      </time>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <span>{entry.title}</span>
          {entry.delayed ? (
            <span className="border border-foreground px-1.5 py-0.5 label-mono">Delayed</span>
          ) : null}
        </p>
        <p className="text-sm text-muted-foreground">
          {episodeLabel(entry)}
          {entry.delayedText && entry.delayedText !== "Delayed" ? ` · ${entry.delayedText}` : null}
        </p>
      </div>
      {action}
    </li>
  );
}

type WeekListProps = {
  days: readonly ScheduleDay[];
  now: Date;
  action?: (entry: ScheduleEntry) => React.ReactNode;
};

export function WeekList({ days, now, action }: WeekListProps) {
  const today = dayWindowOf(now).day;

  return (
    <Stagger className="grid gap-10">
      {days.map(({ day, entries }) => {
        return (
          <StaggerItem key={day}>
            <section aria-labelledby={`day-${day}`}>
              <div className="flex items-baseline justify-between gap-4 border-b border-foreground pb-2">
                <h2 id={`day-${day}`} className="font-display text-3xl leading-none">
                  {formatWeekday(day)}
                </h2>
                <p className="flex items-center gap-3 label-mono">
                  {day === today ? (
                    <span className="bg-primary px-1.5 py-0.5 text-primary-foreground">Today</span>
                  ) : null}
                  <span className="text-muted-foreground">{formatDayDate(day)}</span>
                </p>
              </div>
              {entries.length ? (
                <ul>
                  {entries.map((entry) => (
                    <EntryRow
                      key={`${entry.showRoute}#${entry.episodeNumber}`}
                      entry={entry}
                      action={action?.(entry)}
                    />
                  ))}
                </ul>
              ) : (
                <p className="py-3 text-sm text-muted-foreground">Nothing airs.</p>
              )}
            </section>
          </StaggerItem>
        );
      })}
    </Stagger>
  );
}
