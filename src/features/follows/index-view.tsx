"use client";

import { cn } from "cn";
import * as m from "motion/react-m";
import { useState } from "react";

import { Reveal } from "@/components/motion/reveal";
import {
  ARRIVE,
  HIDDEN,
  NUDGE,
  SETTLE,
  SHOWN,
  STAGGER,
  SWAP,
  ZOOM,
} from "@/components/motion/tokens";
import { LineReveal, RuleDraw } from "@/components/motion/unveil";
import {
  dayWindowOf,
  formatAirTime,
  formatUntil,
  formatWeekdayShort,
} from "@/features/schedule/day-window";
import { episodeLabel } from "@/features/schedule/episode-label";
import { Cover } from "@/features/schedule/poster-wall";

import { FollowButton } from "./follow-button";
import type { IndexRow } from "./show-index";

type IndexViewProps = { rows: readonly IndexRow[]; now: Date; today: string; toAirToday: number };

const REST: Record<IndexRow["status"], string> = {
  upcoming: "Airs this week",
  aired: "Aired this week",
  delayed: "Delayed",
  quiet: "Not this week",
  finished: "Finished",
};

function when(row: IndexRow, today: string): string {
  if (!row.next) return REST[row.status];
  const airAt = new Date(row.next.airAt);
  const day = dayWindowOf(airAt).day;
  return `${day === today ? "Today" : formatWeekdayShort(day)} ${formatAirTime(airAt)}`;
}

type PinnedProps = { row: IndexRow; under: IndexRow | undefined; now: Date; today: string };

function Pinned({ row, under, now, today }: PinnedProps) {
  return (
    <aside aria-label="Selected show" className="hidden lg:block">
      <div className="sticky top-8 pt-5">
        <p className="sr-only">{row.title}</p>
        <div className="relative aspect-[2/3] overflow-hidden border border-foreground bg-muted">
          {under ? (
            <div key={`under-${under.route}`} className="absolute inset-0 bg-muted">
              <Cover entry={under} sizes="320px" greyscale={under.status === "finished"} />
            </div>
          ) : null}
          <m.div
            key={row.route}
            data-arrive
            className="absolute inset-0 bg-muted"
            initial={{ clipPath: "inset(0% 0% 100% 0%)" }}
            animate={{ clipPath: "inset(0% 0% 0% 0%)" }}
            transition={SWAP}
          >
            <m.div
              data-arrive
              className="absolute inset-0"
              initial={{ scale: ZOOM }}
              animate={{ scale: 1 }}
              transition={SETTLE}
            >
              <Cover entry={row} sizes="320px" greyscale={row.status === "finished"} />
            </m.div>
          </m.div>
        </div>
        <div className="mt-4 flex items-baseline justify-between gap-4">
          <p className="font-mono text-4xl leading-none tabular-nums">
            {row.next ? formatAirTime(new Date(row.next.airAt)) : "—"}
          </p>
          <p className="label-mono text-muted-foreground">
            {row.next ? formatUntil(new Date(row.next.airAt), now) : when(row, today)}
          </p>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          {row.next ? episodeLabel(row.next) : "No episode left this week"}
        </p>
      </div>
    </aside>
  );
}

export function IndexView({ rows, now, today, toAirToday }: IndexViewProps) {
  const [trail, setTrail] = useState<{ chosen: string | null; before: string | null }>({
    chosen: null,
    before: null,
  });
  const active = rows.find((row) => row.route === trail.chosen) ?? rows[0];
  const under = rows.find((row) => row.route === trail.before);
  const choose = (route: string) =>
    setTrail((last) => {
      const shown = last.chosen ?? rows[0]?.route ?? null;
      return shown === route ? last : { chosen: route, before: shown };
    });
  const following = rows.filter((row) => row.status !== "finished").length;

  return (
    <div className="mx-auto w-full max-w-6xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="font-display text-6xl leading-none sm:text-7xl">
          <LineReveal>My week</LineReveal>
        </h1>
        <Reveal delay={0.3}>
          <p className="label-mono text-muted-foreground">
            {following} following · {toAirToday} to air today
          </p>
        </Reveal>
      </div>
      <RuleDraw className="mt-4" delay={0.2} />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem]">
        <ol>
          {rows.map((row, index) => {
            const isActive = row.route === active?.route;
            return (
              <m.li
                key={row.route}
                data-arrive
                initial={HIDDEN}
                animate={SHOWN}
                transition={{ ...ARRIVE, delay: 0.3 + index * STAGGER }}
                onMouseEnter={() => choose(row.route)}
                onFocus={() => choose(row.route)}
                className="grid grid-cols-[2rem_3rem_1fr] items-center gap-x-4 gap-y-2 border-b border-border py-5 sm:grid-cols-[2.5rem_1fr_auto_auto]"
              >
                <span
                  aria-hidden
                  className={cn(
                    "font-mono text-sm tabular-nums",
                    isActive ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div className="relative aspect-[2/3] overflow-hidden border border-foreground bg-muted text-[0.5rem] sm:hidden">
                  <Cover entry={row} sizes="48px" greyscale={row.status === "finished"} />
                </div>
                <m.div
                  data-arrive
                  className="min-w-0"
                  animate={{ x: isActive ? NUDGE : 0 }}
                  transition={ARRIVE}
                >
                  <p
                    className={cn(
                      "font-display text-3xl leading-tight sm:text-4xl",
                      row.status === "finished" && "text-muted-foreground",
                    )}
                  >
                    {row.title}
                  </p>
                  <p className="text-sm text-muted-foreground sm:hidden">{when(row, today)}</p>
                </m.div>
                <span className="hidden label-mono tabular-nums sm:block">{when(row, today)}</span>
                <div className="col-start-3 sm:col-start-auto">
                  <FollowButton showRoute={row.route} title={row.title} followed />
                </div>
              </m.li>
            );
          })}
        </ol>
        {active ? <Pinned row={active} under={under} now={now} today={today} /> : null}
      </div>
    </div>
  );
}
