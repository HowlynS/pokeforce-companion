import { describe, expect, it } from "vitest";
import {
  createPermissionContext,
  hasEffectivePermission,
} from "./permission-resolver";

const ADMINISTRATOR = { id: "admin-1", role: "ADMINISTRATOR" as const };

describe("effective permission resolution", () => {
  it("uses a role grant and defaults missing permissions to denied", () => {
    const context = createPermissionContext({
      user: ADMINISTRATOR,
      rolePermissionKeys: ["content.items.edit"],
    });

    expect(hasEffectivePermission(context, "content.items.edit")).toBe(true);
    expect(hasEffectivePermission(context, "content.items.delete")).toBe(false);
  });

  it("applies ALLOW and DENY before the role fallback", () => {
    const context = createPermissionContext({
      user: ADMINISTRATOR,
      rolePermissionKeys: ["content.items.delete"],
      userOverrides: [
        { permissionKey: "content.items.edit", effect: "ALLOW" },
        { permissionKey: "content.items.delete", effect: "DENY" },
      ],
    });

    expect(hasEffectivePermission(context, "content.items.edit")).toBe(true);
    expect(hasEffectivePermission(context, "content.items.delete")).toBe(false);
  });

  it("treats absent overrides as INHERIT", () => {
    const inherited = createPermissionContext({
      user: ADMINISTRATOR,
      rolePermissionKeys: ["content.locations.edit"],
    });

    expect(hasEffectivePermission(inherited, "content.locations.edit")).toBe(
      true
    );
  });

  it("ignores stale stored keys and rejects unknown requested keys", () => {
    const context = createPermissionContext({
      user: ADMINISTRATOR,
      rolePermissionKeys: ["content.items.superuser"],
      userOverrides: [
        { permissionKey: "removed.permission", effect: "ALLOW" },
      ],
    });

    expect(hasEffectivePermission(context, "content.items.superuser")).toBe(
      false
    );
    expect(hasEffectivePermission(context, "removed.permission")).toBe(false);
  });

  it("cannot grant protected authority to a non-Owner", () => {
    const context = createPermissionContext({
      user: ADMINISTRATOR,
      rolePermissionKeys: ["security.roles.permissions.manage"],
      userOverrides: [
        {
          permissionKey: "security.members.roles.manage",
          effect: "ALLOW",
        },
      ],
    });

    expect(
      hasEffectivePermission(context, "security.roles.permissions.manage")
    ).toBe(false);
    expect(
      hasEffectivePermission(context, "security.members.roles.manage")
    ).toBe(false);
  });

  it("gives the protected Owner every registered permission independently", () => {
    const owner = createPermissionContext({
      user: { id: "owner-1", role: "OWNER" },
      userOverrides: [
        { permissionKey: "content.items.edit", effect: "DENY" },
      ],
    });

    expect(hasEffectivePermission(owner, "content.items.edit")).toBe(true);
    expect(
      hasEffectivePermission(owner, "security.members.permissions.manage")
    ).toBe(true);
    expect(hasEffectivePermission(owner, "unknown.permission")).toBe(false);
  });
});
