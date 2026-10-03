import * as z from "zod";

import { createFakeSource, FAKE_SCENARIOS } from "@/features/schedule/fake-source";
import { runScheduleSync, scheduleSource } from "@/features/schedule/sync";
import { devRoutesEnabled, fakesEnabled } from "@/lib/env";

// A development and end-to-end trigger for the schedule sync, so the data cache is expired from
// inside the server. It has no authentication, so it does not exist in a real production
// deployment; the scheduled, signature-checked job endpoint is a later ticket.

const bodySchema = z.object({ scenario: z.enum(FAKE_SCENARIOS).default("base") });

export async function POST(request: Request) {
  if (!devRoutesEnabled()) return new Response(null, { status: 404 });

  const body: unknown = await request.json().catch(() => ({}));
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: "Unknown scenario." }, { status: 400 });

  const source = fakesEnabled() ? createFakeSource(parsed.data.scenario) : scheduleSource();
  const run = await runScheduleSync(source);
  return Response.json(run, { status: run.outcome === "success" ? 200 : 502 });
}
