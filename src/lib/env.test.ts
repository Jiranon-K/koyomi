import { describe, expect, it } from "vitest";

import { authEnv, dbEnv, devRoutesEnabled, fakesEnabled, scheduleEnv } from "./env";

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
