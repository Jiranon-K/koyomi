import type { Wall, WallEntry } from "@/features/schedule/wall";

import type { FollowedShow } from "./service";

export type IndexRow = FollowedShow & {
  next: WallEntry | null;
  status: "upcoming" | "aired" | "delayed" | "quiet" | "finished";
};

export function showIndex(
  wall: Wall,
  following: readonly FollowedShow[],
  finished: readonly FollowedShow[],
): IndexRow[] {
  const entries = wall.days.flatMap((day) => day.entries);

  const airing = following.map((show): IndexRow => {
    const mine = entries.filter((entry) => entry.showRoute === show.route);
    const next = mine.find((entry) => !entry.aired && !entry.delayed) ?? null;
    if (next) return { ...show, next, status: "upcoming" };
    if (mine.some((entry) => entry.delayed)) return { ...show, next, status: "delayed" };
    return { ...show, next, status: mine.length ? "aired" : "quiet" };
  });
  const upcoming = airing
    .filter((row) => row.next)
    .sort((a, b) => (a.next?.airAt ?? "").localeCompare(b.next?.airAt ?? ""));

  return [
    ...upcoming,
    ...airing.filter((row) => !row.next),
    ...finished.map((show): IndexRow => ({ ...show, next: null, status: "finished" })),
  ];
}
