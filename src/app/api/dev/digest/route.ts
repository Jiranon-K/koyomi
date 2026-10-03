import { lastDigestRun } from "@/features/notifications/digest";
import { jobQueue } from "@/features/notifications/jobs";
import { fakesEnabled } from "@/lib/env";

// The end-to-end trigger for the daily digest. It has no authentication, so it only exists while
// the fakes are on: the queue then runs the jobs in this process and the "LINE messages" go to the
// server log. With the real services the digest is started by the signed job endpoint alone.
export async function POST() {
  if (!fakesEnabled()) return new Response(null, { status: 404 });

  await jobQueue().enqueue("digest-fanout", {});
  return Response.json(await lastDigestRun());
}
