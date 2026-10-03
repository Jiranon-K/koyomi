import { handleLineWebhook } from "@/features/line/webhook";
import { botEventHandlers } from "@/features/notifications/bot-reply";

// LINE's Messaging API calls this for every event on the bot. The signature check, and everything
// after it, lives in the features: `line` owns the webhook and the friendship events, and
// `notifications` adds the bot's answers to messages.
export async function POST(request: Request) {
  return handleLineWebhook(request, { handlers: botEventHandlers() });
}
