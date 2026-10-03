import { handleJobRequest } from "@/features/notifications/job-route";

export async function POST(request: Request) {
  return handleJobRequest(request, "sync-schedule");
}
