import type { Metadata } from "next";

import { Stagger, StaggerItem } from "@/components/motion/stagger";
import { StatusNote as Note, StatusRow as Row } from "@/components/status-row";
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
              <Note>Your LINE account is connected to {user.email}.</Note>
              <DisconnectLineButton />
            </Row>
            <Row label="Bot" state={status.friend ? "Friend" : "Not a friend yet"}>
              <Note>
                {status.friend
                  ? "The Koyomi bot can message you on LINE."
                  : "The Koyomi bot can only message its friends. Add it in LINE, then reload this page."}
              </Note>
              {!status.friend && addFriendUrl ? (
                <p className="text-sm">
                  <TextLink href={addFriendUrl} target="_blank" rel="noreferrer">
                    Add the bot
                  </TextLink>
                </p>
              ) : null}
            </Row>
            <Row label="Reminders" state={status.remindersOn ? "On" : "Off"}>
              <Note>{reminderNote(status)}</Note>
              <ReminderSwitch on={status.switchedOn} />
            </Row>
          </>
        ) : (
          <>
            <Row label="LINE" state="Not connected">
              {lineEnabled ? (
                <>
                  <Note>
                    You will be asked to add the Koyomi bot as a friend on the way, so that its
                    messages can reach you.
                  </Note>
                  <ConnectLineButton />
                </>
              ) : (
                <Note>LINE is not set up on this server yet.</Note>
              )}
            </Row>
            <Row label="Reminders" state="Off">
              <Note>Connect LINE to switch reminders on.</Note>
            </Row>
          </>
        )}
      </dl>
    </Stagger>
  );
}
