import { describe, expect, it } from "vitest";
import { assignableRoles, canCreateRole, canManageUser } from "./policy";

describe("user-management policy", () => {
  it("lets Administrators manage only Members and Contributors", () => {
    expect(canCreateRole("ADMINISTRATOR", "MEMBER")).toBe(true);
    expect(canCreateRole("ADMINISTRATOR", "CONTRIBUTOR")).toBe(true);
    expect(canCreateRole("ADMINISTRATOR", "ADMINISTRATOR")).toBe(false);
    expect(canCreateRole("ADMINISTRATOR", "OWNER")).toBe(false);
  });

  it("lets Owners assign every fixed role", () => {
    expect(assignableRoles("OWNER")).toEqual([
      "MEMBER",
      "CONTRIBUTOR",
      "ADMINISTRATOR",
      "OWNER",
    ]);
  });

  it("prohibits self-management and Administrator escalation", () => {
    expect(
      canManageUser(
        { id: "same", role: "OWNER" },
        { id: "same", role: "OWNER" }
      )
    ).toBe(false);
    expect(
      canManageUser(
        { id: "admin", role: "ADMINISTRATOR" },
        { id: "owner", role: "OWNER" }
      )
    ).toBe(false);
  });
});
