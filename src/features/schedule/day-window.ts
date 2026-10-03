export const SCHEDULE_TIME_ZONE = "Asia/Bangkok";
export const DAY_START_HOUR = 5;

export type DayWindow = {
  day: string;
  start: Date;
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

function asUtc({ year, month, day, hour, minute }: WallTime): number {
  return Date.UTC(year, month - 1, day, hour, minute);
}

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

export function dayWindowOf(instant: Date): DayWindow {
  const wall = wallTimeOf(instant);
  const calendarDay = Date.UTC(wall.year, wall.month - 1, wall.day);
  return windowStartingOn(wall.hour < DAY_START_HOUR ? calendarDay - DAY_MS : calendarDay);
}

export function dayWindowFor(day: DayWindow["day"]): DayWindow {
  return windowStartingOn(calendarDayMs(day));
}

export function weekWindows(now: Date, days = 7): DayWindow[] {
  const first = calendarDayMs(dayWindowOf(now).day);
  return Array.from({ length: days }, (_, index) => windowStartingOn(first + index * DAY_MS));
}

export function weekRange(now: Date): { start: Date; end: Date; windows: DayWindow[] } {
  const today = dayWindowOf(now);
  const windows = weekWindows(now);
  return { start: today.start, end: windows.at(-1)?.end ?? today.end, windows };
}

export function isScheduleDay(day: string): boolean {
  const ms = calendarDayMs(day);
  return !Number.isNaN(ms) && isoDay(ms) === day;
}

export function calendarMonthOf(instant: Date): string {
  const { year, month } = wallTimeOf(instant);
  return `${year}-${String(month).padStart(2, "0")}`;
}

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

export function formatDateTime(instant: Date): string {
  return dateTime.format(instant);
}

const weekday = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "long" });
const dayDate = new Intl.DateTimeFormat("en-GB", {
  timeZone: "UTC",
  day: "numeric",
  month: "short",
});

export function formatWeekday(day: DayWindow["day"]): string {
  return weekday.format(calendarDayMs(day));
}

const weekdayShort = new Intl.DateTimeFormat("en-GB", { timeZone: "UTC", weekday: "short" });

export function formatWeekdayShort(day: DayWindow["day"]): string {
  return weekdayShort.format(calendarDayMs(day));
}

export function dayOfMonth(day: DayWindow["day"]): number {
  return new Date(calendarDayMs(day)).getUTCDate();
}

export function formatDayDate(day: DayWindow["day"]): string {
  return dayDate.format(calendarDayMs(day));
}
