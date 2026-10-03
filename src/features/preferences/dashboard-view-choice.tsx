"use client";

import { useActionState } from "react";

import { Button } from "@/components/ui/button";
import { FormError } from "@/features/auth/form-field";

import { setDashboardViewAction } from "./actions";
import {
  DASHBOARD_VIEW_LABELS,
  DASHBOARD_VIEWS,
  type DashboardView,
  type PreferenceActionState,
} from "./schema";

const IDLE: PreferenceActionState = { error: null };

export function DashboardViewChoice({ current }: { current: DashboardView }) {
  const [state, action, pending] = useActionState(setDashboardViewAction, IDLE);

  return (
    <form action={action} className="grid justify-items-start gap-3">
      <div role="group" aria-label="Dashboard view" className="flex">
        {DASHBOARD_VIEWS.map((view) => (
          <Button
            key={view}
            type="submit"
            name="view"
            value={view}
            size="sm"
            variant={view === current ? "default" : "outline"}
            aria-pressed={view === current}
            aria-busy={pending}
            disabled={pending}
            className="not-first:border-l-0"
          >
            {DASHBOARD_VIEW_LABELS[view]}
          </Button>
        ))}
      </div>
      <FormError message={state.error} />
    </form>
  );
}
