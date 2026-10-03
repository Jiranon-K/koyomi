import { indexesReady, isDuplicateKey } from "@/lib/db/mongoose";

import { Preference } from "./model";
import { DEFAULT_DASHBOARD_VIEW, type DashboardView } from "./schema";

const ready = indexesReady(() => Preference.init());

export async function getDashboardView(userId: string): Promise<DashboardView> {
  await ready();
  const preference = await Preference.findOne({ userId }).select({ dashboardView: 1 }).lean();
  return preference?.dashboardView ?? DEFAULT_DASHBOARD_VIEW;
}

export async function setDashboardView(userId: string, view: DashboardView): Promise<void> {
  await ready();
  const store = () =>
    Preference.updateOne({ userId }, { $set: { dashboardView: view } }, { upsert: true });
  try {
    await store();
  } catch (error) {
    if (!isDuplicateKey(error)) throw error;
    await store();
  }
}
