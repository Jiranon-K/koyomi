import type { Metadata } from "next";
import Link from "next/link";
import { connection } from "next/server";

import { Masthead } from "@/components/masthead";
import { Reveal } from "@/components/motion/reveal";
import { TextLink } from "@/components/text-link";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { SIGN_IN_PATH } from "@/features/auth/paths";
import { formatDateTime } from "@/features/schedule/day-window";
import { cachedWeekSchedule } from "@/features/schedule/sync";
import { WeekList } from "@/features/schedule/week-list";

export const metadata: Metadata = { title: "Schedule" };

export default async function SchedulePage() {
  // "This week" depends on the moment of the request, so the page is rendered per request; the
  // schedule itself comes from the data cache, never from the source.
  await connection();
  const now = new Date();
  const { days, lastSyncedAt } = await cachedWeekSchedule(now);

  return (
    <div className="flex min-h-screen flex-col">
      <Masthead>
        <Button asChild variant="ghost" size="sm">
          <Link href={SIGN_IN_PATH}>Sign in</Link>
        </Button>
        <ThemeToggle />
      </Masthead>

      <main className="mx-auto w-full max-w-3xl flex-1 px-6 py-16 sm:px-10">
        <Reveal>
          <h1 className="font-display text-5xl leading-none">This week</h1>
          <p className="mt-2 max-w-xl text-muted-foreground">
            Japanese broadcast times, shown in Thai time. A day runs from 05:00 to 05:00, so a
            late-night episode stays with the evening it belongs to.
          </p>
        </Reveal>

        <div className="mt-12">
          {lastSyncedAt ? (
            <WeekList days={days} now={now} />
          ) : (
            <p className="border-t border-foreground py-4 text-muted-foreground">
              The schedule has not been synced yet. Check back soon.
            </p>
          )}
        </div>

        <footer className="mt-12 border-t border-foreground pt-4 text-sm text-muted-foreground">
          <p>
            Schedule data from{" "}
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
