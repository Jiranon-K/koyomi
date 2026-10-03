import { existsSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

import { createFakeSource } from "./fake-source";

describe("createFakeSource", () => {
  it("points every cover at a file the app serves, and leaves one show without a cover", async () => {
    const { episodes } = await createFakeSource().fetchTimetable(new Date("2026-10-03T05:00:00Z"));
    const covers = episodes.map((episode) => episode.show.coverUrl);
    const local = covers.filter((cover) => cover !== null);

    expect(covers).toContain(null);
    expect(local.length).toBeGreaterThan(0);
    for (const cover of local) {
      expect(cover.startsWith("/images/fake-covers/")).toBe(true);
      expect(existsSync(path.join(process.cwd(), "public", cover))).toBe(true);
    }
  });
});
