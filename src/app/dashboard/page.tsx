import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/features/auth/session";
import { FeatureView } from "@/features/follows/feature-view";
import { IndexView } from "@/features/follows/index-view";
import { myWeek } from "@/features/follows/service";
import { showIndex } from "@/features/follows/show-index";
import { getDashboardView } from "@/features/preferences/service";
import { SCHEDULE_PATH } from "@/features/schedule/paths";
import { posterWall } from "@/features/schedule/wall";

export const metadata: Metadata = { title: "My week" };

export default async function DashboardPage() {
  const { user } = await requireSession();
  const now = new Date();
  const [{ days, following, finished }, view] = await Promise.all([
    myWeek(user.id, now),
    getDashboardView(user.id),
  ]);

  if (following.length === 0 && finished.length === 0) {
    return (
      <div className="mx-auto w-full max-w-3xl">
        <Reveal>
          <h1 className="font-display text-5xl leading-none">My week</h1>
          <p className="mt-2 text-muted-foreground">
            Signed in as <span className="break-all text-foreground">{user.email}</span>
          </p>
        </Reveal>
        <Reveal className="mt-12 border-t border-foreground pt-6">
          <p className="max-w-xl">
            You are not following any shows yet. Open the schedule and press Follow next to a show:
            its episodes will be listed here, in Thai time, on the days they air.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href={SCHEDULE_PATH}>Browse the schedule</Link>
          </Button>
        </Reveal>
      </div>
    );
  }

  const wall = posterWall(days, now, new Set(following.map((show) => show.route)));
  return view === "index" ? (
    <IndexView
      rows={showIndex(wall, following, finished)}
      now={now}
      today={wall.today.day}
      toAirToday={wall.today.remaining}
    />
  ) : (
    <FeatureView wall={wall} now={now} following={following} finished={finished} />
  );
}
