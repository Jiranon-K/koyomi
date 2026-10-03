import { handleLineWebhook } from "@/features/line/webhook";
import { botEventHandlers } from "@/features/notifications/bot-reply";

export async function POST(request: Request) {
  return handleLineWebhook(request, { handlers: botEventHandlers() });
}
