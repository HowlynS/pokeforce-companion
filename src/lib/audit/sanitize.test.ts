import { describe, expect, it } from "vitest";
import { sanitizeAuditMetadata } from "./sanitize";

describe("audit metadata sanitization", () => {
  it("removes secrets recursively", () => {
    const sanitized = sanitizeAuditMetadata({
      role: "MEMBER",
      password: "never",
      nested: { accessToken: "never", cookie: "never", changed: true },
      serviceRoleKey: "never",
      signedUrl: "never",
    });
    expect(sanitized).toEqual({ role: "MEMBER", nested: { changed: true } });
    expect(JSON.stringify(sanitized)).not.toContain("never");
  });

  it("bounds strings, arrays, and deep structures", () => {
    const sanitized = sanitizeAuditMetadata({
      long: "x".repeat(400),
      values: Array.from({ length: 30 }, (_, index) => index),
      deep: { a: { b: { c: { d: "hidden" } } } },
    });
    expect(String(sanitized?.long).length).toBeLessThan(250);
    expect(sanitized?.values).toHaveLength(20);
    expect(JSON.stringify(sanitized)).not.toContain("hidden");
  });
});
