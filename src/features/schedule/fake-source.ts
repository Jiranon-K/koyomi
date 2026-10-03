import { DAY_START_HOUR, dayWindowOf } from "./day-window";
import type { ScheduleSource, ShowStatus, SourceEpisode } from "./source";

export const FAKE_SCENARIOS = ["base", "revised"] as const;
export type FakeScenario = (typeof FAKE_SCENARIOS)[number];

type Slot = {
  route: string;
  title: string;
  status: ShowStatus;
  totalEpisodes: number;
  episodeNumber: number;
  day: number;
  at: `${number}:${number}`;
  delayedText?: string;
};

const SLOTS: Slot[] = [
  {
    route: "lantern-street-diaries",
    title: "Lantern Street Diaries",
    status: "ongoing",
    totalEpisodes: 12,
    episodeNumber: 5,
    day: 0,
    at: "22:30",
  },
  {
    route: "clockwork-orchard",
    title: "Clockwork Orchard",
    status: "ongoing",
    totalEpisodes: 24,
    episodeNumber: 3,
    day: 0,
    at: "00:30",
  },
  {
    route: "salt-and-starlight",
    title: "Salt and Starlight",
    status: "delayed",
    totalEpisodes: 12,
    episodeNumber: 7,
    day: 1,
    at: "23:00",
    delayedText: "Delayed one week",
  },
  {
    route: "the-ninth-platform",
    title: "The Ninth Platform",
    status: "ongoing",
    totalEpisodes: 0,
    episodeNumber: 2,
    day: 2,
    at: "21:00",
  },
  {
    route: "moss-and-thunder",
    title: "Moss and Thunder",
    status: "upcoming",
    totalEpisodes: 13,
    episodeNumber: 1,
    day: 6,
    at: "05:00",
  },
  {
    route: "harbor-of-paper-cranes",
    title: "Harbor of Paper Cranes",
    status: "finished",
    totalEpisodes: 13,
    episodeNumber: 13,
    day: -3,
    at: "20:00",
  },
  {
    route: "lantern-street-diaries",
    title: "Lantern Street Diaries",
    status: "ongoing",
    totalEpisodes: 12,
    episodeNumber: 6,
    day: 7,
    at: "22:30",
  },
];

const HOUR_MS = 60 * 60 * 1000;

function airAt(now: Date, slot: Slot): Date {
  const [hour = 0, minute = 0] = slot.at.split(":").map(Number);
  const hoursIntoDay = (hour < DAY_START_HOUR ? hour + 24 : hour) - DAY_START_HOUR;
  const start = dayWindowOf(now).start.getTime() + slot.day * 24 * HOUR_MS;
  return new Date(start + hoursIntoDay * HOUR_MS + minute * 60_000);
}

export function createFakeSource(scenario: FakeScenario = "base"): ScheduleSource {
  return {
    name: "fake",
    async fetchTimetable(now) {
      const episodes = SLOTS.map((slot): SourceEpisode => {
        const newlyDelayed = scenario === "revised" && slot.route === "the-ninth-platform";
        const delayedText = newlyDelayed ? "Delayed" : (slot.delayedText ?? null);
        return {
          show: {
            route: slot.route,
            title: slot.title,
            status: newlyDelayed ? "delayed" : slot.status,
            totalEpisodes: slot.totalEpisodes,
          },
          episodeNumber: slot.episodeNumber,
          firstEpisodeNumber: null,
          airAt: airAt(now, slot),
          delayed: delayedText !== null,
          delayedText,
        };
      });
      return { episodes, requests: 0, skipped: 0 };
    },
  };
}
