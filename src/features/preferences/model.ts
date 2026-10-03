import { Schema } from "mongoose";

import { defineModel } from "@/lib/db/mongoose";

import { DASHBOARD_VIEWS, type DashboardView } from "./schema";

export type PreferenceDoc = {
  userId: string;
  dashboardView: DashboardView;
};

const preferenceSchema = new Schema<PreferenceDoc>({
  userId: { type: String, required: true },
  dashboardView: { type: String, required: true, enum: [...DASHBOARD_VIEWS] },
});
preferenceSchema.index({ userId: 1 }, { unique: true });

export const Preference = defineModel("Preference", preferenceSchema);
