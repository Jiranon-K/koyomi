import { handleJobRequest } from "@/features/notifications/job-route";

// The 09:00 Bangkok digest: finds who gets a message today and enqueues one job per user. QStash
// calls this; the signature check, and everything after it, lives in the feature.
export async function POST(request: Request) {
  return handleJobRequest(request, "digest-fanout");
}
