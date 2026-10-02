import { describe, expect, it } from "vitest";

import { fieldErrors, signInSchema, signUpSchema } from "./schema";

describe("signUpSchema", () => {
  const valid = { name: "Ada", email: "ada@example.com", password: "correct horse battery" };

  it("accepts a complete sign-up and trims the name and email", () => {
    const result = signUpSchema.parse({ ...valid, name: "  Ada ", email: " ada@example.com " });

    expect(result).toEqual(valid);
  });

  it("reports a malformed email on the email field", () => {
    const result = signUpSchema.safeParse({ ...valid, email: "not-an-email" });

    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).email).toBeTruthy();
  });

  it("reports a password shorter than 8 characters on the password field", () => {
    const result = signUpSchema.safeParse({ ...valid, password: "short" });

    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).password).toMatch(/8/);
  });

  it("reports a blank name", () => {
    const result = signUpSchema.safeParse({ ...valid, name: "   " });

    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).name).toBeTruthy();
  });
});

describe("signInSchema", () => {
  it("accepts any non-empty password so old short passwords are not refused client-side", () => {
    expect(signInSchema.safeParse({ email: "ada@example.com", password: "x" }).success).toBe(true);
  });

  it("reports a missing password", () => {
    const result = signInSchema.safeParse({ email: "ada@example.com", password: "" });

    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).password).toBeTruthy();
  });
});
