// A schedule "day" runs from 05:00 to 05:00 in Thai time, so a broadcast at 00:30 is listed under
// the evening it follows. Every feature that asks "what airs today / this week" goes through here.

export const SCHEDULE_TIME_ZONE = "Asia/Bangkok";
export const DAY_START_HOUR = 5;

export type DayWindow = {
  /** The Bangkok calendar date the window starts on, as `YYYY-MM-DD`. */
  day: string;
  /** Inclusive start: 05:00 Bangkok time on `day`. */
  start: Date;
  /** Exclusive end: 05:00 Bangkok time on the following date. */
  end: Date;
};

type WallTime = { year: number; month: number; day: number; hour: number; minute: number };

const DAY_MS = 24 * 60 * 60 * 1000;

const wallClock = new Intl.DateTimeFormat("en-CA", {
  timeZone: SCHEDULE_TIME_ZONE,
  hourCycle: "h23",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
});

function wallTimeOf(instant: Date): WallTime {
  const parts = new Map(wallClock.formatToParts(instant).map((part) => [part.type, part.value]));
  const read = (type: Intl.DateTimeFormatPartTypes) => Number(parts.get(type));
  return {
    year: read("year"),
    month: read("month"),
    day: read("day"),
    hour: read("hour"),
    minute: read("minute"),
  };
}

// The wall time written as if it were UTC: a plain number line for calendar arithmetic.
function asUtc({ year, month, day, hour, minute }: WallTime): number {
  return Date.UTC(year, month - 1, day, hour, minute);
}

// The instant at which the zone's clocks show `wall`. The zone's offset is read from `Intl` rather
// than hard-coded; the second pass settles the answer if the offset differs at the first guess.
function instantOf(wall: WallTime): Date {
  const target = asUtc(wall);
  let guess = target;
  for (let pass = 0; pass < 2; pass++) {
    guess -= asUtc(wallTimeOf(new Date(guess))) - target;
  }
  return new Date(guess);
}

function isoDay(utcMs: number): string {
  return new Date(utcMs).toISOString().slice(0, 10);
}

function windowStartingOn(dayUtcMs: number): DayWindow {
  const at = (ms: number) => {
    const date = new Date(ms);
    return instantOf({
      year: date.getUTCFullYear(),
      month: date.getUTCMonth() + 1,
      day: date.getUTCDate(),
      hour: DAY_START_HOUR,
      minute: 0,
    });
  };
  return { day: isoDay(dayUtcMs), start: at(dayUtcMs), end: at(dayUtcMs + DAY_MS) };
}

function calendarDayMs(day: DayWindow["day"]): number {
  return Date.parse(`${day}T00:00:00Z`);
}

/** The schedule day that contains `instant`. */
export function dayWindowOf(instant: Date): DayWindow {
  const wall = wallTimeOf(instant);
  const calendarDay = Date.UTC(wall.year, wall.month - 1, wall.day);
  return windowStartingOn(wall.hour < DAY_START_HOUR ? calendarDay - DAY_MS : calendarDay);
}

/** `days` consecutive schedule days, the first being the one that contains `now`. */
export function weekWindows(now: Date, days = 7): DayWindow[] {
  const first = calendarDayMs(dayWindowOf(now).day);
  return Array.from({ length: days }, (_, index) => windowStartingOn(first + index * DAY_MS));
}

/** Files items under the window their air time falls in, earliest first; the rest are dropped. */
export function groupByDay<Item>(
  items: readonly Item[],
  airAt: (item: Item) => Date,
  windows: readonly DayWindow[],
): { window: DayWindow; items: Item[] }[] {
  return windows.map((window) => ({
    window,
    items: items
      .filter((item) => airAt(item) >= window.start && airAt(item) < window.end)
      .sort((a, b) => airAt(a).getTime() - airAt(b).getTime()),
  }));
}

const airTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHEDULE_TIME_ZONE,
  hourCycle: "h23",
  hour: "2-digit",
  minute: "2-digit",
});

/** The Thai clock time of an instant, as `HH:mm`. */
export function formatAirTime(instant: Date): string {
  return airTime.format(instant);
}

const dateTime = new Intl.DateTimeFormat("en-GB", {
  timeZone: SCHEDULE_TIME_ZONE,
  hourCycle: "h23",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

/** The Thai calendar date and clock time of an instant, e.g. `3 Oct, 12:00`. */
export function formatDateTime(instant: Date): string {
  return dateTime.format(instant);
}

const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" });
const dayDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

/** The weekday of a schedule day, e.g. `Saturday`. */
export function formatWeekday(day: DayWindow["day"]): string {
  return weekday.format(calendarDayMs(day));
}

/** The date of a schedule day, e.g. `3 Oct`. */
export function formatDayDate(day: DayWindow["day"]): string {
  return dayDate.format(calendarDayMs(day));
}
