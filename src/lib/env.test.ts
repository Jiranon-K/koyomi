import { afterEach, describe, expect, it, vi } from "vitest";

import {
  appUrl,
  authEnv,
  dbEnv,
  devRoutesEnabled,
  fakesEnabled,
  lineBotEnv,
  lineLoginEnv,
  lineMessagingEnv,
  lineWebhookEnv,
  qstashEnv,
  qstashSigningEnv,
  redactSecrets,
  scheduleEnv,
} from "./env";

describe("fakesEnabled", () => {
  it("is off unless USE_FAKES is true", () => {
    expect(fakesEnabled({})).toBe(false);
    expect(fakesEnabled({ USE_FAKES: "" })).toBe(false);
    expect(fakesEnabled({ USE_FAKES: "false" })).toBe(false);
    expect(fakesEnabled({ USE_FAKES: "true" })).toBe(true);
  });

  it("rejects any other value by name", () => {
    expect(() => fakesEnabled({ USE_FAKES: "yes" })).toThrow(/USE_FAKES must be true or false/);
  });
});

describe("scheduleEnv", () => {
  it("returns the token for the real source", () => {
    expect(scheduleEnv({ ANIMESCHEDULE_TOKEN: "token-value" })).toEqual({
      ANIMESCHEDULE_TOKEN: "token-value",
    });
  });

  it("names the token when it is missing or empty", () => {
    expect(() => scheduleEnv({})).toThrow(/ANIMESCHEDULE_TOKEN is not set/);
    expect(() => scheduleEnv({ ANIMESCHEDULE_TOKEN: "" })).toThrow(
      /ANIMESCHEDULE_TOKEN is not set/,
    );
  });
});

describe("devRoutesEnabled", () => {
  it("is on with the fakes or under next dev, and off in a real production build", () => {
    expect(devRoutesEnabled({ USE_FAKES: "true", NODE_ENV: "production" })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: "development" })).toBe(true);
    expect(devRoutesEnabled({ NODE_ENV: "production" })).toBe(false);
    expect(devRoutesEnabled({})).toBe(false);
  });
});

const SECRET = "test-secret-test-secret-test-secret-1234";
const valid = {
  BETTER_AUTH_SECRET: SECRET,
  BETTER_AUTH_URL: "http://localhost:3000",
};

describe("dbEnv", () => {
  it("returns the connection string", () => {
    const uri = "mongodb://127.0.0.1:27017/app";
    expect(dbEnv({ MONGODB_URI: uri })).toEqual({ MONGODB_URI: uri });
  });

  it("accepts a mongodb+srv connection string", () => {
    const uri = "mongodb+srv://cluster.example.net/app";
    expect(dbEnv({ MONGODB_URI: uri }).MONGODB_URI).toBe(uri);
  });

  it("names the variable when it is missing", () => {
    expect(() => dbEnv({})).toThrow(/MONGODB_URI is not set/);
  });

  it("treats an empty value as missing", () => {
    expect(() => dbEnv({ MONGODB_URI: "" })).toThrow(/MONGODB_URI is not set/);
  });

  it("rejects a value that is not a MongoDB connection string", () => {
    expect(() => dbEnv({ MONGODB_URI: "postgres://localhost/app" })).toThrow(/MONGODB_URI/);
  });
});

describe("authEnv", () => {
  it("returns the validated values", () => {
    expect(authEnv({ ...valid, ADMIN_EMAILS: "owner@example.com" })).toEqual({
      ...valid,
      ADMIN_EMAILS: "owner@example.com",
    });
  });

  it("leaves ADMIN_EMAILS undefined when it is empty", () => {
    expect(authEnv({ ...valid, ADMIN_EMAILS: "" }).ADMIN_EMAILS).toBeUndefined();
  });

  it("names every missing variable in one error", () => {
    expect(() => authEnv({})).toThrow(
      /BETTER_AUTH_SECRET is not set[\s\S]*BETTER_AUTH_URL is not set/,
    );
  });

  it("rejects a secret shorter than 32 characters", () => {
    expect(() => authEnv({ ...valid, BETTER_AUTH_SECRET: "too-short" })).toThrow(
      /BETTER_AUTH_SECRET must be at least 32 characters/,
    );
  });

  it("rejects a base URL that is not a URL", () => {
    expect(() => authEnv({ ...valid, BETTER_AUTH_URL: "localhost" })).toThrow(/BETTER_AUTH_URL/);
  });

  it("rejects a base URL with a trailing slash", () => {
    expect(() => authEnv({ ...valid, BETTER_AUTH_URL: "http://localhost:3000/" })).toThrow(
      /BETTER_AUTH_URL must not end with a slash/,
    );
  });

  it("does not print the secret in the error", () => {
    const leaked = "short-secret-value";
    let message = "";
    try {
      authEnv({ ...valid, BETTER_AUTH_SECRET: leaked });
    } catch (error) {
      message = String(error);
    }
    expect(message).toMatch(/BETTER_AUTH_SECRET/);
    expect(message).not.toContain(leaked);
  });

  it("points at .env.example", () => {
    expect(() => authEnv({})).toThrow(/\.env\.example/);
  });
});

describe("lineLoginEnv", () => {
  it("is off when neither variable is set", () => {
    expect(lineLoginEnv({})).toBeUndefined();
  });

  it("is off when only one of the two is set", () => {
    expect(lineLoginEnv({ LINE_LOGIN_CHANNEL_ID: "id" })).toBeUndefined();
    expect(lineLoginEnv({ LINE_LOGIN_CHANNEL_SECRET: "secret" })).toBeUndefined();
  });

  it("is off when a value is empty", () => {
    expect(
      lineLoginEnv({ LINE_LOGIN_CHANNEL_ID: "id", LINE_LOGIN_CHANNEL_SECRET: "" }),
    ).toBeUndefined();
  });

  it("returns the credentials when both are set", () => {
    expect(
      lineLoginEnv({ LINE_LOGIN_CHANNEL_ID: "id", LINE_LOGIN_CHANNEL_SECRET: "secret" }),
    ).toEqual({ clientId: "id", clientSecret: "secret" });
  });
});

describe("LINE configuration warnings", () => {
  async function freshEnv() {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fresh = await import("./env");
    return { ...fresh, warned: () => warn.mock.calls.map(String) };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [{ LINE_LOGIN_CHANNEL_ID: "the-channel-id" }, "LINE_LOGIN_CHANNEL_SECRET"],
    [{ LINE_LOGIN_CHANNEL_SECRET: "the-channel-secret" }, "LINE_LOGIN_CHANNEL_ID"],
    [
      { LINE_LOGIN_CHANNEL_ID: "the-channel-id", LINE_LOGIN_CHANNEL_SECRET: "" },
      "LINE_LOGIN_CHANNEL_SECRET",
    ],
  ])("names the missing variable when only one is set", async (source, missing) => {
    const { lineLoginEnv, warned } = await freshEnv();

    lineLoginEnv(source);

    expect(warned()).toHaveLength(1);
    expect(warned()[0]).toContain(`${missing} is not set`);
    expect(warned()[0]).toMatch(/\.env\.example/);
  });

  it.each([
    [{ LINE_LOGIN_CHANNEL_ID: "the-channel-id" }, "the-channel-id"],
    [{ LINE_LOGIN_CHANNEL_SECRET: "the-channel-secret" }, "the-channel-secret"],
  ])("does not print the value that was set", async (source, value) => {
    const { lineLoginEnv, warned } = await freshEnv();

    lineLoginEnv(source);

    expect(warned()).toHaveLength(1);
    expect(warned()[0]).not.toContain(value);
  });

  it("warns once, not on every call", async () => {
    const { lineLoginEnv, warned } = await freshEnv();

    lineLoginEnv({ LINE_LOGIN_CHANNEL_ID: "the-channel-id" });
    lineLoginEnv({ LINE_LOGIN_CHANNEL_ID: "the-channel-id" });

    expect(warned()).toHaveLength(1);
  });

  it.each([
    ["both are set", { LINE_LOGIN_CHANNEL_ID: "id", LINE_LOGIN_CHANNEL_SECRET: "secret" }],
    ["neither is set", {}],
    ["both are empty", { LINE_LOGIN_CHANNEL_ID: "", LINE_LOGIN_CHANNEL_SECRET: "" }],
  ])("stays quiet when %s", async (_case, source) => {
    const { lineLoginEnv, warned } = await freshEnv();

    lineLoginEnv(source);

    expect(warned()).toEqual([]);
  });

  it("reports a malformed bot basic ID once, without printing it", async () => {
    const { lineBotEnv, warned } = await freshEnv();

    expect(lineBotEnv({ LINE_BOT_BASIC_ID: "https://evil.example/x" })).toBeUndefined();
    lineBotEnv({ LINE_BOT_BASIC_ID: "https://evil.example/x" });

    expect(warned()).toHaveLength(1);
    expect(warned()[0]).toContain("LINE_BOT_BASIC_ID");
    expect(warned()[0]).not.toContain("evil.example");
  });
});

describe("lineWebhookEnv", () => {
  it("is undefined when the channel secret is missing or empty", () => {
    expect(lineWebhookEnv({})).toBeUndefined();
    expect(lineWebhookEnv({ LINE_MESSAGING_CHANNEL_SECRET: "" })).toBeUndefined();
  });

  it("returns the channel secret when it is set", () => {
    expect(lineWebhookEnv({ LINE_MESSAGING_CHANNEL_SECRET: "secret" })).toEqual({
      channelSecret: "secret",
    });
  });
});

describe("lineBotEnv", () => {
  it("is undefined when the basic ID is not set", () => {
    expect(lineBotEnv({})).toBeUndefined();
    expect(lineBotEnv({ LINE_BOT_BASIC_ID: "" })).toBeUndefined();
  });

  it("builds the add-friend link from the basic ID", () => {
    expect(lineBotEnv({ LINE_BOT_BASIC_ID: "@123abcde" })).toEqual({
      addFriendUrl: "https://line.me/R/ti/p/%40123abcde",
    });
  });
});

describe("lineMessagingEnv", () => {
  it("returns the channel access token, or nothing when it is not set", () => {
    expect(lineMessagingEnv({ LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "token-value" })).toEqual({
      channelAccessToken: "token-value",
    });
    expect(lineMessagingEnv({})).toBeUndefined();
    expect(lineMessagingEnv({ LINE_MESSAGING_CHANNEL_ACCESS_TOKEN: "" })).toBeUndefined();
  });
});

describe("qstashEnv", () => {
  it("returns the token and the default QStash address", () => {
    expect(qstashEnv({ QSTASH_TOKEN: "token-value" })).toEqual({
      token: "token-value",
      url: "https://qstash.upstash.io",
    });
  });

  it("takes another region's address from QSTASH_URL", () => {
    expect(
      qstashEnv({ QSTASH_TOKEN: "token-value", QSTASH_URL: "https://qstash-us-east-1.upstash.io" })
        .url,
    ).toBe("https://qstash-us-east-1.upstash.io");
  });

  it("names what is missing or malformed, never a value", () => {
    expect(() => qstashEnv({})).toThrow(/QSTASH_TOKEN is not set/);
    expect(() => qstashEnv({ QSTASH_TOKEN: "" })).toThrow(/QSTASH_TOKEN is not set/);
    expect(() => qstashEnv({ QSTASH_TOKEN: "token-value", QSTASH_URL: "nonsense" })).toThrow(
      /^QSTASH_URL must be a full URL\. See \.env\.example\.$/,
    );
  });
});

describe("qstashSigningEnv", () => {
  it("returns both signing keys only when both are set", () => {
    expect(
      qstashSigningEnv({ QSTASH_CURRENT_SIGNING_KEY: "current", QSTASH_NEXT_SIGNING_KEY: "next" }),
    ).toEqual({ currentSigningKey: "current", nextSigningKey: "next" });
    expect(qstashSigningEnv({})).toBeUndefined();
    expect(
      qstashSigningEnv({ QSTASH_CURRENT_SIGNING_KEY: "", QSTASH_NEXT_SIGNING_KEY: "" }),
    ).toBeUndefined();
  });

  it.each([
    [{ QSTASH_CURRENT_SIGNING_KEY: "current-key-value" }, "QSTASH_NEXT_SIGNING_KEY"],
    [{ QSTASH_NEXT_SIGNING_KEY: "next-key-value" }, "QSTASH_CURRENT_SIGNING_KEY"],
  ])("is off with one key, and names the missing one once: %o", async (source, missing) => {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fresh = await import("./env");

    expect(fresh.qstashSigningEnv(source)).toBeUndefined();
    expect(fresh.qstashSigningEnv(source)).toBeUndefined();

    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0])).toContain(`${missing} is not set`);
    expect(String(warn.mock.calls[0])).not.toMatch(/key-value/);
    warn.mockRestore();
  });
});

describe("appUrl", () => {
  it("is the public origin from BETTER_AUTH_URL", () => {
    expect(appUrl({ BETTER_AUTH_SECRET: SECRET, BETTER_AUTH_URL: "https://koyomi.example" })).toBe(
      "https://koyomi.example",
    );
    expect(() => appUrl({ BETTER_AUTH_SECRET: SECRET })).toThrow(/BETTER_AUTH_URL is not set/);
  });
});

describe("redactSecrets", () => {
  const address = (scheme: string, credentials: string, rest: string) =>
    `${scheme}://${credentials}@${rest}`;
  const source = {
    BETTER_AUTH_SECRET: SECRET,
    ANIMESCHEDULE_TOKEN: "animeschedule-token-value",
    QSTASH_CURRENT_SIGNING_KEY: "sig_current_key_value",
    MONGODB_URI: address("mongodb", "koyomi:db-password", "db.example:27017/koyomi"),
    BETTER_AUTH_URL: "https://koyomi.example",
    ADMIN_EMAILS: "owner@example.com",
    LINE_MESSAGING_CHANNEL_SECRET: "",
    SHORT_TOKEN: "abc",
  };

  it("replaces the value of every secret variable with its name", () => {
    const text = `Bearer animeschedule-token-value was refused; ${SECRET}; sig_current_key_value; ${source.MONGODB_URI}`;

    expect(redactSecrets(text, source)).toBe(
      "Bearer [ANIMESCHEDULE_TOKEN] was refused; [BETTER_AUTH_SECRET]; [QSTASH_CURRENT_SIGNING_KEY]; [MONGODB_URI]",
    );
  });

  it("leaves text and variables that are not secret alone", () => {
    const text = "AnimeSchedule answered 500 for owner@example.com at https://koyomi.example";

    expect(redactSecrets(text, source)).toBe(text);
  });

  it("ignores a secret that is unset or too short to be one", () => {
    expect(redactSecrets("abc and the rest", source)).toBe("abc and the rest");
  });

  it("hides the credentials of any address and any bearer token, configured or not", () => {
    expect(
      redactSecrets(
        `${address("mongodb+srv", "user:hunter2", "cluster.example/db")} refused Bearer abc.def-123`,
        {},
      ),
    ).toBe("mongodb+srv://[hidden]@cluster.example/db refused Bearer [hidden]");
  });
});
