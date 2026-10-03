import { handleJobRequest } from "@/features/notifications/job-route";

// The scheduled schedule sync (every six hours, and 08:45 Bangkok time). QStash calls this; the
// signature check, and everything after it, lives in the feature.
export async function POST(request: Request) {
  return handleJobRequest(request, "sync-schedule");
}
