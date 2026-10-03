import type { Metadata } from "next";
import Link from "next/link";

import { Masthead } from "@/components/masthead";
import { Reveal } from "@/components/motion/reveal";
import { TextLink } from "@/components/text-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { DASHBOARD_PATH, SIGN_IN_PATH, signInPathReturningTo } from "@/features/auth/paths";
import { currentSession } from "@/features/auth/session";
import { FollowButton } from "@/features/follows/follow-button";
import { followedRoutes } from "@/features/follows/service";
import { formatDateTime, formatDayDate, formatWeekday } from "@/features/schedule/day-window";
import { SCHEDULE_PATH } from "@/features/schedule/paths";
import { Cover, PosterWall } from "@/features/schedule/poster-wall";
import { cachedWeekSchedule } from "@/features/schedule/sync";
import { UpNext } from "@/features/schedule/up-next";
import { posterWall, type WallEntry } from "@/features/schedule/wall";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  const session = await currentSession();
  const now = new Date();
  const [{ days, lastSyncedAt }, followed] = await Promise.all([
    cachedWeekSchedule(now),
    session ? followedRoutes(session.user.id) : [],
  ]);
  const wall = posterWall(days, now, new Set(followed));
  const { upNext, today } = wall;

  const action = (entry: WallEntry) =>
    session ? (
      <FollowButton showRoute={entry.showRoute} title={entry.title} followed={entry.followed} />
    ) : (
      <Button asChild variant="outline" size="sm">
        <Link href={signInPathReturningTo(SCHEDULE_PATH)} aria-label={`Follow ${entry.title}`}>
          Follow
        </Link>
      </Button>
    );

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Button asChild variant="ghost" size="sm">
          {session ? (
            <Link href={DASHBOARD_PATH}>My week</Link>
          ) : (
            <Link href={SIGN_IN_PATH}>Sign in</Link>
          )}
        </Button>
        <ThemeToggle />
      </Masthead>

      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-16 sm:px-10">
        <Reveal
          slideOnly
          className={
            upNext
              ? "grid gap-8 md:grid-cols-[minmax(0,18rem)_1fr] md:items-end md:gap-12"
              : undefined
          }
        >
          {upNext ? (
            <div className="relative aspect-[2/3] w-40 overflow-hidden border border-foreground bg-muted md:w-full">
              <Cover entry={upNext} sizes="(min-width: 768px) 288px, 160px" eager />
            </div>
          ) : null}
          <div>
            <p className="label-mono text-muted-foreground">
              {formatWeekday(today.day)} · {formatDayDate(today.day)} · Thai time
            </p>
            <h1 className="mt-4 font-display text-6xl leading-none sm:text-7xl">
              On air this <em className="text-primary">week</em>
            </h1>
            {upNext ? (
              <UpNext entry={upNext} now={now} today={today.day} action={action(upNext)} />
            ) : null}
            <p className="mt-6 max-w-xl text-muted-foreground">
              {lastSyncedAt
                ? `${today.remaining} still to air today, ${today.aired} already out${
                    today.delayed ? `, ${today.delayed} delayed` : ""
                  }. `
                : null}
              Japanese broadcast times, shown in Thai time. A day runs from 05:00 to 05:00, so a
              late-night episode stays with the evening it belongs to.
            </p>
          </div>
        </Reveal>

        <div className="mt-12">
          {lastSyncedAt ? (
            <PosterWall days={wall.days} today={today.day} action={action} />
          ) : (
            <p className="border-t border-foreground py-4 text-muted-foreground">
              The schedule has not been synced yet. Check back soon.
            </p>
          )}
        </div>

        <footer className="mt-12 border-t border-foreground pt-4 text-sm text-muted-foreground">
          <p>
            Schedule data and covers from{" "}
            <TextLink href="https://animeschedule.net" target="_blank" rel="noopener noreferrer">
              AnimeSchedule.net
            </TextLink>
            .{lastSyncedAt ? ` Updated ${formatDateTime(new Date(lastSyncedAt))} Thai time.` : null}
          </p>
        </footer>
      </main>
    </div>
  );
}
