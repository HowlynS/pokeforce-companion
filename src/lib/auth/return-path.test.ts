import { describe, expect, it } from "vitest";
import { loginPathFor, safeReturnPath } from "./return-path";

describe("safe return paths", () => {
  it("preserves same-origin relative paths and queries", () => {
    expect(safeReturnPath("/items/iron-ore?from=search")).toBe(
      "/items/iron-ore?from=search"
    );
  });

  it.each([
    "https://evil.example/path",
    "//evil.example/path",
    "/\\evil.example/path",
    "javascript:alert(1)",
    "/login",
    "/items\nX-Test: bad",
  ])("rejects unsafe return value %s", (value) => {
    expect(safeReturnPath(value)).toBe("/");
  });

  it("encodes a validated destination into the login URL", () => {
    expect(loginPathFor("/recipes?q=iron")).toBe(
      "/login?next=%2Frecipes%3Fq%3Diron"
    );
  });
});
