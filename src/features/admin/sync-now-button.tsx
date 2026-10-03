"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormError, FormNotice } from "@/features/auth/form-field";

import { syncNowAction } from "./actions";
import type { SyncNowState } from "./schema";

const IDLE: SyncNowState = { error: null, notice: null };

export function SyncNowButton() {
  const [state, action, pending] = useActionState(syncNowAction, IDLE);

  return (
    <form action={action} className="grid justify-items-start gap-3">
      <Button type="submit" disabled={pending} aria-busy={pending}>
        {pending ? "Syncing…" : "Sync now"}
      </Button>
      <FormError message={pending ? null : state.error} />
      <FormNotice message={pending ? null : state.notice} />
    </form>
  );
}
