import { NextResponse } from "next/server";

import { listTasks } from "@/features/tasks/service";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json({ tasks: await listTasks() });
  } catch {
    return NextResponse.json({ error: "Database unavailable" }, { status: 503 });
  }
}
