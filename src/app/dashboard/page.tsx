import type { Metadata } from "next";
import Link from "next/link";

import { Reveal } from "@/components/motion/reveal";
import { Button } from "@/components/ui/button";
import { requireSession } from "@/features/auth/session";
import { FollowButton } from "@/features/follows/follow-button";
import { myWeek, type FollowedShow } from "@/features/follows/service";
import { SCHEDULE_PATH } from "@/features/schedule/paths";
import { WeekList } from "@/features/schedule/week-list";

export const metadata: Metadata = { title: "My week" };

function ShowList({ id, title, shows }: { id: string; title: string; shows: FollowedShow[] }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="border-b border-foreground pb-2 font-display text-3xl leading-none">
        {title}
      </h2>
      <ul>
        {shows.map((show) => (
          <li
            key={show.route}
            className="flex items-center justify-between gap-4 border-b border-border py-3"
          >
            <span>{show.title}</span>
            <FollowButton showRoute={show.route} title={show.title} followed />
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function DashboardPage() {
  const { user } = await requireSession();
  const now = new Date();
  const { days, following, finished } = await myWeek(user.id, now);
  const airing = days.filter((day) => day.entries.length > 0);
  const followsNothing = following.length === 0 && finished.length === 0;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <Reveal>
        <h1 className="font-display text-5xl leading-none">My week</h1>
        <p className="mt-2 text-muted-foreground">
          Signed in as <span className="break-all text-foreground">{user.email}</span>
        </p>
      </Reveal>

      {followsNothing ? (
        <Reveal className="mt-12 border-t border-foreground pt-6">
          <p className="max-w-xl">
            You are not following any shows yet. Open the schedule and press Follow next to a show:
            its episodes will be listed here, in Thai time, on the days they air.
          </p>
          <Button asChild size="lg" className="mt-6">
            <Link href={SCHEDULE_PATH}>Browse the schedule</Link>
          </Button>
        </Reveal>
      ) : (
        <div className="mt-12 grid gap-12">
          {airing.length ? (
            <WeekList days={airing} now={now} />
          ) : (
            <p className="border-t border-foreground pt-4 text-muted-foreground">
              None of your shows air in the next seven days.
            </p>
          )}
          {following.length ? (
            <ShowList id="following" title="Following" shows={following} />
          ) : null}
          {finished.length ? <ShowList id="finished" title="Finished" shows={finished} /> : null}
        </div>
      )}
    </div>
  );
}
