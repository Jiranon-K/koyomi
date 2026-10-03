import { afterEach, describe, expect, it, vi } from "vitest";

import { fetchFriendship } from "./friendship";

function lineAnswers(answer: () => Response | Promise<Response>) {
  const fetch = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return answer();
  });
  vi.stubGlobal("fetch", fetch);
  return fetch;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("fetchFriendship", () => {
  it("asks LINE with the user's access token", async () => {
    const fetch = lineAnswers(() => Response.json({ friendFlag: true }));

    await fetchFriendship("the-access-token");

    const [url, init] = fetch.mock.calls[0] ?? [];
    expect(url).toBe("https://api.line.me/friendship/v1/status");
    expect(new Headers(init?.headers).get("authorization")).toBe("Bearer the-access-token");
  });

  it.each([true, false])("reports friendFlag %s as LINE gave it", async (friendFlag) => {
    lineAnswers(() => Response.json({ friendFlag }));

    expect(await fetchFriendship("token")).toBe(friendFlag);
  });

  it.each([
    ["LINE refuses the token", () => Response.json({ message: "invalid" }, { status: 401 })],
    ["LINE answers without a friend flag", () => Response.json({})],
    ["LINE answers with something that is not JSON", () => new Response("<html>")],
    [
      "LINE cannot be reached",
      () => {
        throw new TypeError("fetch failed");
      },
    ],
  ])("does not guess when %s", async (_case, answer) => {
    lineAnswers(answer);

    expect(await fetchFriendship("token")).toBeUndefined();
  });
});
