import { handleLineWebhook } from "@/features/line/webhook";

// LINE's Messaging API calls this for every event on the bot. The signature check, and everything
// after it, lives in the feature.
export async function POST(request: Request) {
  return handleLineWebhook(request);
}
