import * as z from "zod";

export const DASHBOARD_VIEWS = ["feature", "index"] as const;

export type DashboardView = (typeof DASHBOARD_VIEWS)[number];

export const DEFAULT_DASHBOARD_VIEW: DashboardView = "feature";

export const DASHBOARD_VIEW_LABELS: Record<DashboardView, string> = {
  feature: "Feature",
  index: "Index",
};

export const dashboardViewSchema = z.object({ view: z.enum(DASHBOARD_VIEWS) });

export type PreferenceActionState = { error: string | null };
