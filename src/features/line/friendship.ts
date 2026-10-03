import * as z from "zod";

const FRIENDSHIP_STATUS_URL = "https://api.line.me/friendship/v1/status";
const TIMEOUT_MS = 3000;

const friendshipSchema = z.object({ friendFlag: z.boolean() });

/**
 * Ask LINE whether the user who owns this LINE Login access token is a friend of the bot linked
 * to the Login channel. `undefined` means LINE could not be asked or did not answer clearly; the
 * caller then keeps what it already knew.
 */
export async function fetchFriendship(accessToken: string): Promise<boolean | undefined> {
  try {
    const response = await fetch(FRIENDSHIP_STATUS_URL, {
      headers: { authorization: `Bearer ${accessToken}` },
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    if (!response.ok) return undefined;
    const parsed = friendshipSchema.safeParse(await response.json());
    return parsed.success ? parsed.data.friendFlag : undefined;
  } catch {
    return undefined;
  }
}
