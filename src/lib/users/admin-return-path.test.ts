import { describe, expect, it } from "vitest";
import { adminUserResultPath, adminUserReturnPath } from "./admin-return-path";

describe("admin member action return paths", () => {
  it("returns only to the same member detail route", () => {
    expect(adminUserReturnPath("member-1", "/admin/users/member-1")).toBe(
      "/admin/users/member-1"
    );
    expect(adminUserReturnPath("member-1", "/admin/users/member-2")).toBe(
      "/admin/users"
    );
  });

  it("rejects external, encoded, and missing redirect targets", () => {
    expect(adminUserReturnPath("member-1", "https://example.com")).toBe(
      "/admin/users"
    );
    expect(adminUserReturnPath("member-1", "/admin/users/%2e%2e")).toBe(
      "/admin/users"
    );
    expect(adminUserReturnPath("", "/admin/users/")).toBe("/admin/users");
  });

  it("encodes result query values", () => {
    expect(adminUserResultPath("/admin/users/member-1", "error", "bad value"))
      .toBe("/admin/users/member-1?error=bad+value");
  });
});
