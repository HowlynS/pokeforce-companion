import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  createPermissionContext,
  hasPermission,
  permissionsForContext,
} from "./permissions";

describe("authorization API barrel", () => {
  it("checks effective context rather than hardcoded role meaning", () => {
    const context = createPermissionContext({
      user: { id: "admin-1", role: "ADMINISTRATOR" },
      rolePermissionKeys: ["content.items.edit"],
    });
    expect(hasPermission(context, "content.items.edit")).toBe(true);
    expect(hasPermission(context, "content.items.delete")).toBe(false);
    expect(permissionsForContext(context)).toEqual(["content.items.edit"]);
  });

  it("exposes every registered permission to the protected Owner", () => {
    const context = createPermissionContext({
      user: { id: "owner-1", role: "OWNER" },
    });
    expect(permissionsForContext(context)).toEqual(CAPABILITIES);
  });
});
