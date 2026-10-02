import { describe, expect, it } from "vitest";

import { fieldErrors, resetPasswordSchema, signInSchema, signUpSchema } from "./schema";

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

  it("reports a malformed email on the email field", () => {
    const result = signInSchema.safeParse({ email: "not-an-email", password: "x" });

    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).email).toBeTruthy();
  });

  it("reports a missing password", () => {
    const result = signInSchema.safeParse({ email: "ada@example.com", password: "" });

    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).password).toBeTruthy();
  });
});

describe("signInSchema remember me", () => {
  const credentials = { email: "ada@example.com", password: "x" };

  it("turns a ticked checkbox into true", () => {
    // A ticked checkbox arrives from FormData as "on".
    expect(signInSchema.parse({ ...credentials, rememberMe: "on" }).rememberMe).toBe(true);
  });

  it("turns an unticked checkbox, which is absent from the form data, into false", () => {
    expect(signInSchema.parse(credentials).rememberMe).toBe(false);
  });
});

describe("resetPasswordSchema", () => {
  it("accepts a new password that is long enough and confirmed", () => {
    const result = resetPasswordSchema.safeParse({
      password: "brand new staple secret",
      confirmPassword: "brand new staple secret",
    });

    expect(result.success).toBe(true);
  });

  it("reports a password shorter than 8 characters on the password field", () => {
    const result = resetPasswordSchema.safeParse({ password: "short", confirmPassword: "short" });

    expect(result.success).toBe(false);
    if (!result.success) expect(fieldErrors(result.error).password).toMatch(/8/);
  });

  it("reports a confirmation that does not match on the confirmation field", () => {
    const result = resetPasswordSchema.safeParse({
      password: "brand new staple secret",
      confirmPassword: "brand new staple secrte",
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(fieldErrors(result.error).confirmPassword).toBeTruthy();
      expect(fieldErrors(result.error).password).toBeUndefined();
    }
  });
});
