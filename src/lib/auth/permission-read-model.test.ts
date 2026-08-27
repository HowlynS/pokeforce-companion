import { describe, expect, it } from "vitest";
import {
  ORDINARY_PERMISSION_KEYS,
  PROTECTED_PERMISSION_KEYS,
} from "./permission-registry";
import {
  buildRolePermissionReadModel,
  buildUserPermissionReadModel,
  ordinaryRoleFrom,
  protectedPermissionReadModel,
} from "./permission-read-model";
import { createPermissionContext } from "./permission-resolver";

function flattened<T>(groups: readonly { permissions: readonly T[] }[]) {
  return groups.flatMap(({ permissions }) => permissions);
}

describe("permission editor read models", () => {
  it("accepts only ordinary roles for editable role policy", () => {
    expect(ordinaryRoleFrom("CONTRIBUTOR")).toBe("CONTRIBUTOR");
    expect(ordinaryRoleFrom("OWNER")).toBe("MEMBER");
    expect(ordinaryRoleFrom("unknown", "ADMINISTRATOR")).toBe(
      "ADMINISTRATOR"
    );
  });

  it("derives one registry-ordered ordinary row per permission", () => {
    const model = buildRolePermissionReadModel("MEMBER", [
      "content.items.edit",
      "stale.permission",
      "security.members.roles.manage",
    ]);
    const rows = flattened(model.groups);

    expect(rows.map(({ key }) => key)).toEqual(ORDINARY_PERMISSION_KEYS);
    expect(new Set(rows.map(({ key }) => key)).size).toBe(rows.length);
    expect(rows.find(({ key }) => key === "content.items.edit")?.granted).toBe(
      true
    );
    expect(rows.map(({ key }) => String(key))).not.toContain("stale.permission");
    expect(
      rows.some(({ key }) => key === "security.members.roles.manage")
    ).toBe(false);
  });

  it("keeps protected definitions in a separate read-only collection", () => {
    const protectedRows = protectedPermissionReadModel();

    expect(protectedRows.map(({ key }) => key)).toEqual(
      PROTECTED_PERMISSION_KEYS
    );
    expect(protectedRows.every(({ protection }) => protection === "OWNER_SYSTEM"))
      .toBe(true);
  });

  it("shows role, personal, and effective state without replacing the resolver", () => {
    const model = buildUserPermissionReadModel(
      createPermissionContext({
        user: { id: "member-1", role: "CONTRIBUTOR" },
        rolePermissionKeys: ["content.items.edit", "content.items.delete"],
        userOverrides: [
          { permissionKey: "content.items.edit", effect: "DENY" },
          { permissionKey: "content.locations.edit", effect: "ALLOW" },
          { permissionKey: "removed.permission", effect: "ALLOW" },
        ],
      })
    );
    const rows = flattened(model.groups);
    const denied = rows.find(({ key }) => key === "content.items.edit");
    const allowed = rows.find(({ key }) => key === "content.locations.edit");
    const inherited = rows.find(({ key }) => key === "content.items.delete");

    expect(denied).toMatchObject({
      roleGranted: true,
      personalSetting: "DENY",
      effective: false,
      effectiveSource: "PERSONAL_DENY",
    });
    expect(allowed).toMatchObject({
      roleGranted: false,
      personalSetting: "ALLOW",
      effective: true,
      effectiveSource: "PERSONAL_ALLOW",
    });
    expect(inherited).toMatchObject({
      roleGranted: true,
      personalSetting: "INHERIT",
      effective: true,
      effectiveSource: "ROLE",
    });
  });

  it("presents Owner authority as protected and resolver-effective", () => {
    const model = buildUserPermissionReadModel(
      createPermissionContext({
        user: { id: "owner-1", role: "OWNER" },
        userOverrides: [
          { permissionKey: "content.items.edit", effect: "DENY" },
        ],
      })
    );
    const rows = flattened(model.groups);

    expect(model.ownerProtected).toBe(true);
    expect(rows.every(({ effective }) => effective)).toBe(true);
    expect(rows.every(({ effectiveSource }) => effectiveSource === "OWNER"))
      .toBe(true);
  });
});
