"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/form-field";

import { connectLineAction, disconnectLineAction, setRemindersAction } from "./actions";
import type { SettingsActionState } from "./schema";

const IDLE: SettingsActionState = { error: null };

export function ConnectLineButton() {
  const [state, action, pending] = useActionState(connectLineAction, IDLE);

  return (
    <form action={action} className="grid justify-items-start gap-3">
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Redirecting to LINE…" : "Connect LINE"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

export function DisconnectLineButton() {
  const [state, action, pending] = useActionState(disconnectLineAction, IDLE);

  return (
    <form action={action} className="grid justify-items-start gap-3">
      <Button type="submit" variant="outline" size="sm" disabled={pending} aria-busy={pending}>
        {pending ? "Disconnecting…" : "Disconnect"}
      </Button>
      <FormError message={state.error} />
    </form>
  );
}

/** A square switch in the house style: a ruled track with a block that sits left (off) or right (on). */
export function ReminderSwitch({ on }: { on: boolean }) {
  const [state, action, pending] = useActionState(setRemindersAction, IDLE);

  return (
    <form action={action} className="grid justify-items-start gap-3">
      <input type="hidden" name="on" value={String(!on)} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          role="switch"
          aria-checked={on}
          aria-label="Reminders"
          aria-busy={pending}
          disabled={pending}
          className="group flex h-6 w-11 items-center border border-foreground px-0.5 outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:pointer-events-none aria-checked:bg-primary"
        >
          <span className="size-4 bg-foreground group-aria-checked:translate-x-5 group-aria-checked:bg-primary-foreground" />
        </button>
        <span className="label-mono">{on ? "On" : "Off"}</span>
      </div>
      <FormError message={state.error} />
    </form>
  );
}
