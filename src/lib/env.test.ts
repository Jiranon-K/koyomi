import { afterEach, describe, expect, it, vi } from "vitest";

import { authEnv, dbEnv, googleEnv } from "./env";

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

describe("googleEnv", () => {
  it("is off when neither variable is set", () => {
    expect(googleEnv({})).toBeUndefined();
  });

  it("is off when only one of the two is set", () => {
    expect(googleEnv({ GOOGLE_CLIENT_ID: "id" })).toBeUndefined();
    expect(googleEnv({ GOOGLE_CLIENT_SECRET: "secret" })).toBeUndefined();
  });

  it("is off when a value is empty", () => {
    expect(googleEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "" })).toBeUndefined();
  });

  it("returns the credentials when both are set", () => {
    expect(googleEnv({ GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" })).toEqual({
      clientId: "id",
      clientSecret: "secret",
    });
  });
});

describe("googleEnv warning", () => {
  async function freshGoogleEnv() {
    vi.resetModules();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const fresh = await import("./env");
    return { googleEnv: fresh.googleEnv, warned: () => warn.mock.calls.map(String) };
  }

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([
    [{ GOOGLE_CLIENT_ID: "the-client-id" }, "GOOGLE_CLIENT_SECRET"],
    [{ GOOGLE_CLIENT_SECRET: "the-client-secret" }, "GOOGLE_CLIENT_ID"],
    [{ GOOGLE_CLIENT_ID: "the-client-id", GOOGLE_CLIENT_SECRET: "" }, "GOOGLE_CLIENT_SECRET"],
  ])("names the missing variable when only one is set", async (source, missing) => {
    const { googleEnv, warned } = await freshGoogleEnv();

    googleEnv(source);

    expect(warned()).toHaveLength(1);
    expect(warned()[0]).toContain(`${missing} is not set`);
    expect(warned()[0]).toMatch(/\.env\.example/);
  });

  it.each([
    [{ GOOGLE_CLIENT_ID: "the-client-id" }, "the-client-id"],
    [{ GOOGLE_CLIENT_SECRET: "the-client-secret" }, "the-client-secret"],
  ])("does not print the value that was set", async (source, value) => {
    const { googleEnv, warned } = await freshGoogleEnv();

    googleEnv(source);

    expect(warned()).toHaveLength(1);
    expect(warned()[0]).not.toContain(value);
  });

  it("warns once, not on every call", async () => {
    const { googleEnv, warned } = await freshGoogleEnv();

    googleEnv({ GOOGLE_CLIENT_ID: "the-client-id" });
    googleEnv({ GOOGLE_CLIENT_ID: "the-client-id" });

    expect(warned()).toHaveLength(1);
  });

  it.each([
    ["both are set", { GOOGLE_CLIENT_ID: "id", GOOGLE_CLIENT_SECRET: "secret" }],
    ["neither is set", {}],
    ["both are empty", { GOOGLE_CLIENT_ID: "", GOOGLE_CLIENT_SECRET: "" }],
  ])("stays quiet when %s", async (_case, source) => {
    const { googleEnv, warned } = await freshGoogleEnv();

    googleEnv(source);

    expect(warned()).toEqual([]);
  });
});
