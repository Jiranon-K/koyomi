import { describe, expect, it } from "vitest";

import {
  dayWindowOf,
  formatAirTime,
  formatDateTime,
  formatDayDate,
  formatWeekday,
  groupByDay,
  weekWindows,
} from "./day-window";

// Bangkok is UTC+7, so 05:00 Bangkok is 22:00 UTC on the previous calendar date.
const utc = (text: string) => new Date(`${text}Z`);

describe("dayWindowOf", () => {
  it("runs from 05:00 to 05:00 Bangkok time", () => {
    const window = dayWindowOf(utc("2026-10-03T05:00:00")); // 12:00 Bangkok, Saturday

    expect(window.day).toBe("2026-10-03");
    expect(window.start).toEqual(utc("2026-10-02T22:00:00"));
    expect(window.end).toEqual(utc("2026-10-03T22:00:00"));
  });

  it("puts a broadcast just after midnight under the evening it follows", () => {
    const window = dayWindowOf(utc("2026-10-03T17:30:00")); // 00:30 Bangkok on Sunday

    expect(window.day).toBe("2026-10-03");
  });

  it("keeps 04:59 with the previous day and starts the next day at exactly 05:00", () => {
    expect(dayWindowOf(utc("2026-10-03T21:59:59.999")).day).toBe("2026-10-03");
    expect(dayWindowOf(utc("2026-10-03T22:00:00")).day).toBe("2026-10-04");
  });

  it("crosses a month and a year boundary", () => {
    expect(dayWindowOf(utc("2026-12-31T20:00:00")).day).toBe("2026-12-31"); // 03:00 on 1 January
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
      { name: "late", airAt: utc("2026-10-03T17:30:00") }, // 00:30 Sunday -> Saturday
      { name: "evening", airAt: utc("2026-10-03T15:00:00") }, // 22:00 Saturday
      { name: "edge", airAt: utc("2026-10-03T22:00:00") }, // 05:00 Sunday -> Sunday
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
});
