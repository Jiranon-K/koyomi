import { lastDigestRun } from "@/features/notifications/digest";
import { jobQueue } from "@/features/notifications/jobs";
import { fakesEnabled } from "@/lib/env";

export async function POST() {
  if (!fakesEnabled()) return new Response(null, { status: 404 });

  await jobQueue().enqueue("digest-fanout", {});
  return Response.json(await lastDigestRun());
}
