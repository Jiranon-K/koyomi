import type { Metadata } from "next";

import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { TextLink } from "@/components/text-link";
import { isLineLoginEnabled } from "@/features/auth/auth";
import { lineConnectErrorMessage } from "@/features/auth/line-errors";
import { requireSession } from "@/features/auth/session";
import {
  ConnectLineButton,
  DisconnectLineButton,
  ReminderSwitch,
} from "@/features/line/line-settings";
import { getLineStatus, type LineStatus } from "@/features/line/service";
import { lineBotEnv } from "@/lib/env";

export const metadata: Metadata = { title: "Settings" };

function Row({
  label,
  state,
  children,
}: {
  label: string;
  state: string;
  children?: React.ReactNode;
}) {
  return (
    <StaggerItem className="grid gap-x-4 gap-y-3 border-b border-border py-5 sm:grid-cols-[7rem_1fr]">
      <dt className="pt-1.5 label-mono text-muted-foreground">{label}</dt>
      <dd className="grid gap-3">
        <p className="text-lg leading-snug">{state}</p>
        {children}
      </dd>
    </StaggerItem>
  );
}

function reminderNote(status: Extract<LineStatus, { linked: true }>): string {
  if (status.remindersOn) {
    return "You get one LINE message at 09:00 on each day a show you follow airs.";
  }
  if (status.switchedOn) {
    return "Switched on, but nothing can be sent yet: add the bot as a friend first.";
  }
  return "No messages are sent while this is off.";
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  const { user } = await requireSession();
  const { error } = await searchParams;
  const status = await getLineStatus(user.id);
  // Only what is rendered below crosses to the browser; channel ids and secrets stay on the server.
  const lineEnabled = isLineLoginEnabled();
  const addFriendUrl = lineBotEnv()?.addFriendUrl;

  return (
    <Stagger className="max-w-2xl">
      <StaggerItem>
        <h1 className="font-display text-5xl leading-none">Settings</h1>
      </StaggerItem>
      <StaggerItem>
        <p className="mt-2 text-muted-foreground">
          Connect LINE and Koyomi tells you, each morning, what airs tonight.
        </p>
      </StaggerItem>
      {error ? (
        <StaggerItem>
          <p role="alert" className="mt-6 text-sm text-destructive">
            {lineConnectErrorMessage(String(error))}
          </p>
        </StaggerItem>
      ) : null}

      <dl className="mt-10 border-t border-foreground">
        {status.linked ? (
          <>
            <Row label="LINE" state="Connected">
              <p className="text-sm text-muted-foreground">
                Your LINE account is connected to {user.email}.
              </p>
              <DisconnectLineButton />
            </Row>
            <Row label="Bot" state={status.friend ? "Friend" : "Not a friend yet"}>
              <p className="text-sm text-muted-foreground">
                {status.friend
                  ? "The Koyomi bot can message you on LINE."
                  : "The Koyomi bot can only message its friends. Add it in LINE, then reload this page."}
              </p>
              {!status.friend && addFriendUrl ? (
                <p className="text-sm">
                  <TextLink href={addFriendUrl} target="_blank" rel="noreferrer">
                    Add the bot
                  </TextLink>
                </p>
              ) : null}
            </Row>
            <Row label="Reminders" state={status.remindersOn ? "On" : "Off"}>
              <p className="text-sm text-muted-foreground">{reminderNote(status)}</p>
              <ReminderSwitch on={status.switchedOn} />
            </Row>
          </>
        ) : (
          <>
            <Row label="LINE" state="Not connected">
              {lineEnabled ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    You will be asked to add the Koyomi bot as a friend on the way, so that its
                    messages can reach you.
                  </p>
                  <ConnectLineButton />
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  LINE is not set up on this server yet.
                </p>
              )}
            </Row>
            <Row label="Reminders" state="Off">
              <p className="text-sm text-muted-foreground">Connect LINE to switch reminders on.</p>
            </Row>
          </>
        )}
      </dl>
    </Stagger>
  );
}
