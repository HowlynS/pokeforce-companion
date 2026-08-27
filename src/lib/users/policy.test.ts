import { describe, expect, it } from "vitest";
import { assignableRoles, canCreateRole, canManageUser } from "./policy";

describe("user-management policy", () => {
  it("does not let Administrators assign any role", () => {
    expect(canCreateRole("ADMINISTRATOR", "MEMBER")).toBe(false);
    expect(canCreateRole("ADMINISTRATOR", "CONTRIBUTOR")).toBe(false);
    expect(canCreateRole("ADMINISTRATOR", "ADMINISTRATOR")).toBe(false);
    expect(canCreateRole("ADMINISTRATOR", "OWNER")).toBe(false);
  });

  it("lets Owners assign ordinary roles but never OWNER", () => {
    expect(assignableRoles("OWNER")).toEqual([
      "MEMBER",
      "CONTRIBUTOR",
      "ADMINISTRATOR",
    ]);
    expect(canCreateRole("OWNER", "OWNER")).toBe(false);
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
    expect(
      canManageUser(
        { id: "owner", role: "OWNER" },
        { id: "other-owner", role: "OWNER" }
      )
    ).toBe(false);
  });
});
