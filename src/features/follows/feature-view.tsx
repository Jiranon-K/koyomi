import { cn } from "cn";

import { Marquee } from "@/components/motion/marquee";
import { Reveal } from "@/components/motion/reveal";
import { STAGGER } from "@/components/motion/tokens";
import { Curtain, LineReveal, MaskReveal, RuleDraw } from "@/components/motion/unveil";
import {
  dayOfMonth,
  dayWindowOf,
  formatAirTime,
  formatDayDate,
  formatUntil,
  formatWeekday,
  formatWeekdayShort,
} from "@/features/schedule/day-window";
import { entryKey, episodeLabel } from "@/features/schedule/episode-label";
import { Cover } from "@/features/schedule/poster-wall";
import type { Wall, WallEntry } from "@/features/schedule/wall";

import type { FollowedShow } from "./service";
import { ShowList } from "./show-list";

type FeatureViewProps = {
  wall: Wall;
  now: Date;
  following: readonly FollowedShow[];
  finished: readonly FollowedShow[];
};

function airTime(entry: WallEntry): string {
  return formatAirTime(new Date(entry.airAt));
}

function tileNote(entry: WallEntry): string {
  if (entry.delayed) return "Delayed";
  return entry.aired ? "Aired" : episodeLabel(entry);
}

function MiniTile({ entry, delay }: { entry: WallEntry; delay: number }) {
  return (
    <li>
      <MaskReveal
        inView
        delay={delay}
        className="aspect-[2/3] overflow-hidden border border-foreground bg-muted"
      >
        <Cover entry={entry} sizes="160px" greyscale={entry.aired} />
        <time
          dateTime={entry.airAt}
          className={cn(
            "absolute top-0 left-0 bg-scrim px-1.5 py-0.5 font-mono text-xs text-scrim-foreground tabular-nums",
            entry.delayed && "line-through",
          )}
        >
          {airTime(entry)}
        </time>
      </MaskReveal>
      <p className="mt-1.5 line-clamp-2 text-sm leading-snug">{entry.title}</p>
      <p className="text-xs text-muted-foreground">{tileNote(entry)}</p>
    </li>
  );
}

function SectionTitle({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <>
      <h2 id={id} className="font-display text-4xl leading-none">
        <LineReveal inView>{children}</LineReveal>
      </h2>
      <RuleDraw inView className="mt-3" />
    </>
  );
}

function Feature({ entry, now, today }: { entry: WallEntry; now: Date; today: string }) {
  const airAt = new Date(entry.airAt);
  const day = dayWindowOf(airAt).day;
  const dayName = day === today ? "Today" : formatWeekday(day);

  return (
    <section
      aria-labelledby="feature-title"
      className="mt-8 grid gap-8 md:grid-cols-[auto_minmax(0,5fr)_minmax(0,7fr)] md:gap-10"
    >
      <p
        aria-hidden
        className="hidden label-mono text-muted-foreground [writing-mode:vertical-rl] md:block"
      >
        Up next ／ {dayName}
      </p>
      <Curtain className="aspect-[2/3] max-h-[70vh] w-full border border-foreground bg-muted">
        <Cover entry={entry} sizes="(min-width: 768px) 40vw, 100vw" eager />
      </Curtain>
      <div className="flex flex-col justify-end">
        <Reveal delay={0.5}>
          <p className="flex items-center gap-3 label-mono">
            <span className="bg-primary px-1.5 py-0.5 text-primary-foreground">Up next</span>
            <span className="text-muted-foreground">{formatUntil(airAt, now)}</span>
          </p>
        </Reveal>
        <time
          dateTime={entry.airAt}
          className="mt-6 block font-mono text-7xl leading-none tabular-nums sm:text-8xl lg:text-9xl"
        >
          <LineReveal delay={0.35}>{airTime(entry)}</LineReveal>
        </time>
        <h2
          id="feature-title"
          className="mt-4 font-display text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
        >
          <LineReveal delay={0.5}>{entry.title}</LineReveal>
        </h2>
        <Reveal delay={0.7}>
          <p className="mt-4 text-muted-foreground">
            {episodeLabel(entry)} · {dayName}, Thai time
          </p>
        </Reveal>
        <RuleDraw className="mt-8" delay={0.6} />
      </div>
    </section>
  );
}

export function FeatureView({ wall, now, following, finished }: FeatureViewProps) {
  const { upNext, today, days } = wall;
  const todays = days.find(({ day }) => day === today.day)?.entries ?? [];
  const alsoToday = todays.filter((entry) => entry !== upNext);
  const airsThisWeek = days.some(({ entries }) => entries.length > 0);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex items-baseline justify-between gap-4 label-mono">
        <h1>My week</h1>
        <p className="text-muted-foreground">
          {formatDayDate(today.day)} · {today.remaining} to air · {today.aired} aired
        </p>
      </div>
      <RuleDraw className="mt-3" />

      {upNext ? (
        <Feature entry={upNext} now={now} today={today.day} />
      ) : (
        <p className="py-20 font-display text-5xl leading-none sm:text-7xl">
          <LineReveal>Nothing left to air</LineReveal>
          <LineReveal delay={STAGGER * 2}>
            <em className="text-primary">this week.</em>
          </LineReveal>
        </p>
      )}

      {alsoToday.length ? (
        <section aria-labelledby="also-today" className="mt-20">
          <SectionTitle id="also-today">Also today</SectionTitle>
          <ul className="mt-6 grid grid-cols-3 gap-4 sm:grid-cols-4 md:grid-cols-6">
            {alsoToday.map((entry, index) => (
              <MiniTile key={entryKey(entry)} entry={entry} delay={index * STAGGER} />
            ))}
          </ul>
        </section>
      ) : null}

      {airsThisWeek ? (
        <section aria-labelledby="the-week" className="mt-20">
          <SectionTitle id="the-week">The week</SectionTitle>
          <div className="lg:grid lg:grid-cols-7">
            {days.map(({ day, entries }, column) => (
              <section
                key={day}
                aria-label={`${day === today.day ? "Today" : formatWeekday(day)}, ${formatDayDate(day)}`}
                className="grid grid-cols-[4rem_1fr] gap-4 border-b border-border py-5 lg:block lg:border-b-0 lg:border-l lg:px-3 lg:first:border-l-0 lg:first:pl-0"
              >
                <Reveal inView delay={column * STAGGER}>
                  <p
                    className={cn(
                      "label-mono",
                      day === today.day ? "text-primary" : "text-muted-foreground",
                    )}
                  >
                    {day === today.day ? "Today" : formatWeekdayShort(day)}
                  </p>
                  <p className="font-display text-5xl leading-none">{dayOfMonth(day)}</p>
                </Reveal>
                {entries.length ? (
                  <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:mt-4 lg:grid-cols-1">
                    {entries.map((entry, index) => (
                      <MiniTile
                        key={entryKey(entry)}
                        entry={entry}
                        delay={(column + index) * STAGGER}
                      />
                    ))}
                  </ul>
                ) : (
                  <p className="self-center text-sm text-muted-foreground lg:mt-4">Nothing airs.</p>
                )}
              </section>
            ))}
          </div>
        </section>
      ) : null}

      <Marquee
        items={following.map((show) => show.title)}
        className="mt-20 border-y border-foreground py-4 font-display text-4xl leading-none sm:text-5xl"
      />
      <div className="mt-12 grid gap-12 md:grid-cols-2">
        {following.length ? <ShowList id="following" title="Following" shows={following} /> : null}
        {finished.length ? <ShowList id="finished" title="Finished" shows={finished} /> : null}
      </div>
    </div>
  );
}
