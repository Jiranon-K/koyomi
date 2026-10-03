import { describe, expect, it } from "vitest";

import {
  dayWindowFor,
  dayWindowOf,
  formatAirTime,
  formatDateTime,
  dayOfMonth,
  formatDayDate,
  formatUntil,
  formatWeekday,
  formatWeekdayShort,
  groupByDay,
  weekWindows,
} from "./day-window";

const utc = (text: string) => new Date(`${text}Z`);

describe("dayWindowOf", () => {
  it("runs from 05:00 to 05:00 Bangkok time", () => {
    const window = dayWindowOf(utc("2026-10-03T05:00:00"));

    expect(window.day).toBe("2026-10-03");
    expect(window.start).toEqual(utc("2026-10-02T22:00:00"));
    expect(window.end).toEqual(utc("2026-10-03T22:00:00"));
  });

  it("puts a broadcast just after midnight under the evening it follows", () => {
    const window = dayWindowOf(utc("2026-10-03T17:30:00"));

    expect(window.day).toBe("2026-10-03");
  });

  it("keeps 04:59 with the previous day and starts the next day at exactly 05:00", () => {
    expect(dayWindowOf(utc("2026-10-03T21:59:59.999")).day).toBe("2026-10-03");
    expect(dayWindowOf(utc("2026-10-03T22:00:00")).day).toBe("2026-10-04");
  });

  it("crosses a month and a year boundary", () => {
    expect(dayWindowOf(utc("2026-12-31T20:00:00")).day).toBe("2026-12-31");
    expect(dayWindowOf(utc("2026-12-31T22:00:00")).day).toBe("2027-01-01");
  });

  it("contains its own start and excludes its own end", () => {
    const window = dayWindowOf(utc("2026-10-03T05:00:00"));

    expect(dayWindowOf(window.start).day).toBe(window.day);
    expect(dayWindowOf(window.end).day).not.toBe(window.day);
  });
});

describe("weekWindows", () => {
  it("lists seven consecutive days starting with today's window", () => {
    const windows = weekWindows(utc("2026-10-03T17:30:00"));

    expect(windows.map((window) => window.day)).toEqual([
      "2026-10-03",
      "2026-10-04",
      "2026-10-05",
      "2026-10-06",
      "2026-10-07",
      "2026-10-08",
      "2026-10-09",
    ]);
    for (const [index, window] of windows.entries()) {
      const next = windows[index + 1];
      if (next) expect(window.end).toEqual(next.start);
    }
  });

  it("can list a single day", () => {
    expect(weekWindows(utc("2026-10-03T05:00:00"), 1)).toHaveLength(1);
  });
});

describe("groupByDay", () => {
  it("files each item under its window, in air-time order, and drops what is outside", () => {
    const windows = weekWindows(utc("2026-10-03T05:00:00"), 2);
    const items = [
      { name: "late", airAt: utc("2026-10-03T17:30:00") },
      { name: "evening", airAt: utc("2026-10-03T15:00:00") },
      { name: "edge", airAt: utc("2026-10-03T22:00:00") },
      { name: "before", airAt: utc("2026-10-02T21:59:00") },
      { name: "after", airAt: utc("2026-10-04T22:00:00") },
    ];

    const days = groupByDay(items, (item) => item.airAt, windows);

    expect(days.map((day) => [day.window.day, day.items.map((item) => item.name)])).toEqual([
      ["2026-10-03", ["evening", "late"]],
      ["2026-10-04", ["edge"]],
    ]);
  });
});

describe("formatting", () => {
  it("shows the air time in Bangkok time on a 24-hour clock", () => {
    expect(formatAirTime(utc("2026-10-03T17:30:00"))).toBe("00:30");
    expect(formatAirTime(utc("2026-10-03T15:05:00"))).toBe("22:05");
  });

  it("shows a date and time in Bangkok time", () => {
    expect(formatDateTime(utc("2026-10-03T17:30:00"))).toBe("4 Oct, 00:30");
  });

  it("names a schedule day", () => {
    const { day } = dayWindowOf(utc("2026-10-03T17:30:00"));

    expect(formatWeekday(day)).toBe("Saturday");
    expect(formatDayDate(day)).toBe("3 Oct");
  });

  it.each([
    ["2026-10-03T12:00:00", "now"],
    ["2026-10-03T11:00:00", "now"],
    ["2026-10-03T12:00:01", "in 1 min"],
    ["2026-10-03T12:01:00", "in 1 min"],
    ["2026-10-03T12:24:00", "in 24 min"],
    ["2026-10-03T12:59:00", "in 59 min"],
    ["2026-10-03T12:59:01", "in 1 h"],
    ["2026-10-03T15:00:00", "in 3 h"],
    ["2026-10-03T15:20:00", "in 3 h 20 min"],
    ["2026-10-04T11:59:00", "in 23 h 59 min"],
    ["2026-10-04T11:59:30", "in 1 d"],
    ["2026-10-04T12:00:00", "in 1 d"],
    ["2026-10-05T16:00:00", "in 2 d 4 h"],
    ["2026-10-05T16:40:00", "in 2 d 4 h"],
  ])("says how long until %s from noon on 3 Oct: %s", (target, wording) => {
    expect(formatUntil(utc(target), utc("2026-10-03T12:00:00"))).toBe(wording);
  });

  it("gives a schedule day's short weekday and its day of the month", () => {
    expect(formatWeekdayShort("2026-10-03")).toBe("Sat");
    expect(dayOfMonth("2026-10-03")).toBe(3);
    expect(dayOfMonth("2026-10-31")).toBe(31);
  });
});

describe("dayWindowFor", () => {
  it("is the window of the schedule day with that date", () => {
    const window = dayWindowOf(utc("2026-10-03T17:30:00"));

    expect(dayWindowFor("2026-10-03")).toEqual(window);
    expect(dayWindowFor("2026-12-31").end.toISOString()).toBe("2026-12-31T22:00:00.000Z");
  });
});
