import { handleJobRequest } from "@/features/notifications/job-route";

// One user's digest for one schedule day. QStash calls this once per job the fan-out enqueued,
// and again when a send failed; the signature check and the send-once rule live in the feature.
export async function POST(request: Request) {
  return handleJobRequest(request, "digest-send");
}
