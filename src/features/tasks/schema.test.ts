import { describe, expect, it } from "vitest";

import { createTaskSchema } from "./schema";

describe("createTaskSchema", () => {
  it("trims the title", () => {
    expect(createTaskSchema.parse({ title: "  write tests  " }).title).toBe("write tests");
  });

  it("rejects an empty title", () => {
    expect(createTaskSchema.safeParse({ title: "   " }).success).toBe(false);
  });

  it("rejects a title over 120 characters", () => {
    expect(createTaskSchema.safeParse({ title: "a".repeat(121) }).success).toBe(false);
  });
});
