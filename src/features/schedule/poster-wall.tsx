import { cn } from "cn";
import Image from "next/image";

import {
  dayOfMonth,
  formatAirTime,
  formatDayDate,
  formatWeekday,
  formatWeekdayShort,
} from "./day-window";
import { delayNote, entryKey, episodeLabel } from "./episode-label";
import type { ScheduleDay, ScheduleEntry } from "./service";

const COVER_SIZES =
  "(min-width: 1024px) 200px, (min-width: 768px) 25vw, (min-width: 640px) 33vw, 50vw";

function dayId(day: string): string {
  return `day-${day}`;
}

function episodeCount(count: number): string {
  return count === 1 ? "1 episode" : `${count} episodes`;
}

function DayLinks({ days, today }: { days: readonly ScheduleDay[]; today: string }) {
  return (
    <nav
      aria-label="Jump to a day"
      data-sticky-bar
      className="sticky top-0 z-10 grid grid-cols-7 border-y border-foreground bg-background"
    >
      {days.map(({ day, entries }) => {
        const isToday = day === today;
        return (
          <a
            key={day}
            href={`#${dayId(day)}`}
            aria-current={isToday ? "date" : undefined}
            aria-label={`${isToday ? "Today" : formatWeekday(day)}, ${formatDayDate(day)}, ${episodeCount(entries.length)}`}
            className={cn(
              "flex flex-col items-center border-l border-border px-0.5 py-2 outline-none first:border-l-0 focus-visible:ring-3 focus-visible:ring-ring/50 sm:items-start sm:px-3",
              isToday ? "bg-primary text-primary-foreground" : "hover:bg-muted",
            )}
          >
            <span className="label-mono max-sm:text-[0.625rem] max-sm:tracking-normal">
              {isToday ? "Today" : formatWeekdayShort(day)}
            </span>
            <span className="font-display text-2xl leading-none sm:text-3xl">
              {dayOfMonth(day)}
            </span>
            <span className="mt-1 font-mono text-xs tabular-nums">{entries.length}</span>
          </a>
        );
      })}
    </nav>
  );
}

function Tile({
  entry,
  followed,
  action,
}: {
  entry: ScheduleEntry;
  followed: boolean;
  action?: React.ReactNode;
}) {
  const delay = delayNote(entry);

  return (
    <li className="flex flex-col">
      <div
        className={cn(
          "relative aspect-[2/3] overflow-hidden bg-muted",
          followed ? "border-2 border-primary" : "border border-foreground",
        )}
      >
        {entry.coverUrl ? (
          <Image src={entry.coverUrl} alt="" fill sizes={COVER_SIZES} className="object-cover" />
        ) : (
          <p
            aria-hidden
            className="absolute inset-x-3 inset-y-10 flex items-center justify-center text-center font-display text-xl leading-tight"
          >
            <span className="line-clamp-4 break-words">{entry.title}</span>
          </p>
        )}
        <time
          dateTime={entry.airAt}
          className={cn(
            "absolute top-0 left-0 bg-scrim px-2 py-1 font-mono text-sm text-scrim-foreground tabular-nums",
            entry.delayed && "line-through",
          )}
        >
          {formatAirTime(new Date(entry.airAt))}
        </time>
        {followed || entry.delayed ? (
          <p className="absolute inset-x-0 bottom-0 flex flex-wrap gap-x-3 bg-scrim px-2 py-1 label-mono text-scrim-foreground">
            {followed ? <span>Following</span> : null}
            {entry.delayed ? <span>Delayed</span> : null}
          </p>
        ) : null}
      </div>
      <p className="mt-2 leading-snug">{entry.title}</p>
      <p className="text-sm text-muted-foreground">
        {episodeLabel(entry)}
        {delay ? ` · ${delay}` : null}
      </p>
      {action ? <div className="mt-auto pt-2">{action}</div> : null}
    </li>
  );
}

type PosterWallProps = {
  days: readonly ScheduleDay[];
  today: string;
  followed: ReadonlySet<string>;
  action?: (entry: ScheduleEntry) => React.ReactNode;
};

export function PosterWall({ days, today, followed, action }: PosterWallProps) {
  return (
    <>
      <DayLinks days={days} today={today} />
      {days.map(({ day, entries }) => (
        <section
          key={day}
          id={dayId(day)}
          aria-labelledby={`${dayId(day)}-title`}
          className="pt-12"
        >
          <div className="flex items-baseline justify-between gap-4 border-b border-foreground pb-2">
            <h2
              id={`${dayId(day)}-title`}
              className="font-display text-4xl leading-none sm:text-5xl"
            >
              {day === today ? "Today" : formatWeekday(day)}
            </h2>
            <p className="label-mono text-muted-foreground">
              {formatDayDate(day)} · {episodeCount(entries.length)}
            </p>
          </div>
          {entries.length ? (
            <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
              {entries.map((entry) => (
                <Tile
                  key={entryKey(entry)}
                  entry={entry}
                  followed={followed.has(entry.showRoute)}
                  action={action?.(entry)}
                />
              ))}
            </ul>
          ) : (
            <p className="py-3 text-sm text-muted-foreground">Nothing airs.</p>
          )}
        </section>
      ))}
    </>
  );
}
