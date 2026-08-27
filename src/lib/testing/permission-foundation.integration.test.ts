import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import {
  setRolePermission,
  setUserPermissionOverride,
} from "@/lib/auth/permission-management";
import { INITIAL_ROLE_PERMISSION_PRESETS } from "@/lib/auth/permission-presets";
import {
  PERMISSION_KEYS,
  PROTECTED_PERMISSION_KEYS,
  isPermissionKey,
  isProtectedPermission,
} from "@/lib/auth/permission-registry";
import {
  hasEffectivePermission,
  loadPermissionContext,
} from "@/lib/auth/permission-resolver";
import { changeUserRole } from "@/lib/users/service";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

const MEMBER_ID = "test-permissions-member";
const ADMIN_ID = "test-permissions-admin";
const CASCADE_ID = "test-permissions-cascade";
const TEST_USER_IDS = [MEMBER_ID, ADMIN_ID, CASCADE_ID] as const;
const TEST_PERMISSION = "content.items.edit";
const OVERRIDE_PERMISSION = "content.categories.delete";
const STALE_PERMISSION = "test.stale.permission";
const RUN_STARTED_AT = new Date();

let ownerId = "";

async function cleanup() {
  const prisma = await getVerifiedTestPrisma();

  await prisma.auditEvent.deleteMany({
    where: {
      createdAt: { gte: RUN_STARTED_AT },
      OR: [
        { targetId: { in: [...TEST_USER_IDS] } },
        {
          actorUserId: ownerId || undefined,
          action: { startsWith: "security." },
        },
        { action: "test.permission.rollback" },
      ],
    },
  });
  await prisma.appUser.deleteMany({
    where: { id: { in: [...TEST_USER_IDS] } },
  });
  await prisma.rolePermission.deleteMany({
    where: {
      OR: [
        { role: "MEMBER", permissionKey: TEST_PERMISSION },
        { role: "MEMBER", permissionKey: STALE_PERMISSION },
        { role: "CONTRIBUTOR", permissionKey: TEST_PERMISSION },
      ],
    },
  });
}

async function createUser(
  id: string,
  role: "MEMBER" | "CONTRIBUTOR" | "ADMINISTRATOR"
) {
  const prisma = await getVerifiedTestPrisma();
  return prisma.appUser.create({
    data: {
      id,
      authUserId: `${id}-auth`,
      email: `${id}@example.com`,
      role,
    },
  });
}

beforeAll(async () => {
  const prisma = await getVerifiedTestPrisma();
  await cleanup();
  const owner = await prisma.appUser.findFirst({
    where: { role: "OWNER", status: "ACTIVE" },
    select: { id: true },
  });
  if (!owner) {
    throw new Error("The isolated test database must retain an active Owner.");
  }
  ownerId = owner.id;
});

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await disconnectTestPrisma();
});

describe("permission foundation (integration)", () => {
  it("applies the enum and exact ordinary role presets while Owner stays row-free", async () => {
    const prisma = await getVerifiedTestPrisma();
    const enumValues = await prisma.$queryRaw<Array<{ enumlabel: string }>>`
      SELECT enumlabel
      FROM pg_enum
      JOIN pg_type ON pg_type.oid = pg_enum.enumtypid
      WHERE pg_type.typname = 'PermissionOverrideEffect'
      ORDER BY enumsortorder
    `;
    expect(enumValues.map(({ enumlabel }) => enumlabel)).toEqual([
      "ALLOW",
      "DENY",
    ]);

    for (const role of [
      "MEMBER",
      "CONTRIBUTOR",
      "ADMINISTRATOR",
      "OWNER",
    ] as const) {
      const rows = await prisma.rolePermission.findMany({
        where: { role },
        orderBy: { permissionKey: "asc" },
        select: { permissionKey: true },
      });
      expect(rows.map(({ permissionKey }) => permissionKey)).toEqual(
        [...INITIAL_ROLE_PERMISSION_PRESETS[role]].sort()
      );
    }

    const allRows = await prisma.rolePermission.findMany({
      select: { permissionKey: true },
    });
    expect(
      allRows.every(
        ({ permissionKey }) =>
          isPermissionKey(permissionKey) &&
          !isProtectedPermission(permissionKey)
      )
    ).toBe(true);
    expect(await prisma.appUser.count()).toBeGreaterThan(0);
    expect(
      await prisma.appUser.count({ where: { id: ownerId, role: "OWNER" } })
    ).toBe(1);

    const administratorKeys = new Set<string>(
      INITIAL_ROLE_PERMISSION_PRESETS.ADMINISTRATOR
    );
    expect(administratorKeys.has("content.items.delete")).toBe(true);
    expect(administratorKeys.has("content.locations.delete")).toBe(true);
    expect(administratorKeys.has("content.shops.delete")).toBe(true);
    expect(administratorKeys.has("content.categories.delete")).toBe(false);
    expect(
      INITIAL_ROLE_PERMISSION_PRESETS.CONTRIBUTOR.some((key) =>
        /^content\..+\.(create|edit|delete|verify)$/.test(key)
      )
    ).toBe(false);
  });

  it("enforces compound keys, enum values, and AppUser override cascade", async () => {
    const prisma = await getVerifiedTestPrisma();
    await createUser(CASCADE_ID, "MEMBER");
    await prisma.userPermissionOverride.create({
      data: {
        userId: CASCADE_ID,
        permissionKey: TEST_PERMISSION,
        effect: "ALLOW",
      },
    });
    await expect(
      prisma.userPermissionOverride.create({
        data: {
          userId: CASCADE_ID,
          permissionKey: TEST_PERMISSION,
          effect: "DENY",
        },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    await prisma.rolePermission.create({
      data: { role: "MEMBER", permissionKey: TEST_PERMISSION },
    });
    await expect(
      prisma.rolePermission.create({
        data: { role: "MEMBER", permissionKey: TEST_PERMISSION },
      })
    ).rejects.toMatchObject({ code: "P2002" });

    await prisma.appUser.delete({ where: { id: CASCADE_ID } });
    expect(
      await prisma.userPermissionOverride.count({
        where: { userId: CASCADE_ID },
      })
    ).toBe(0);
  });

  it("resolves Owner, role, ALLOW, DENY, INHERIT, protected, and stale keys from PostgreSQL", async () => {
    const prisma = await getVerifiedTestPrisma();
    const contributor = await createUser(MEMBER_ID, "CONTRIBUTOR");

    const ownerContext = await loadPermissionContext(prisma, {
      id: ownerId,
      role: "OWNER",
    });
    expect(ownerContext.roleGrants.size).toBe(0);
    expect(
      PERMISSION_KEYS.every((key) => hasEffectivePermission(ownerContext, key))
    ).toBe(true);

    await setRolePermission(
      prisma,
      ownerId,
      "CONTRIBUTOR",
      TEST_PERMISSION,
      true
    );
    let context = await loadPermissionContext(prisma, contributor);
    expect(hasEffectivePermission(context, TEST_PERMISSION)).toBe(true);
    expect(
      hasEffectivePermission(context, PROTECTED_PERMISSION_KEYS[0])
    ).toBe(false);

    await setUserPermissionOverride(
      prisma,
      ownerId,
      contributor.id,
      OVERRIDE_PERMISSION,
      "ALLOW"
    );
    context = await loadPermissionContext(prisma, contributor);
    expect(hasEffectivePermission(context, OVERRIDE_PERMISSION)).toBe(true);

    await setUserPermissionOverride(
      prisma,
      ownerId,
      contributor.id,
      TEST_PERMISSION,
      "DENY"
    );
    context = await loadPermissionContext(prisma, contributor);
    expect(hasEffectivePermission(context, TEST_PERMISSION)).toBe(false);

    await setUserPermissionOverride(
      prisma,
      ownerId,
      contributor.id,
      TEST_PERMISSION,
      null
    );
    context = await loadPermissionContext(prisma, contributor);
    expect(hasEffectivePermission(context, TEST_PERMISSION)).toBe(true);

    expect(
      await prisma.auditEvent.groupBy({
        by: ["action"],
        where: {
          createdAt: { gte: RUN_STARTED_AT },
          actorUserId: ownerId,
          OR: [
            { action: "security.role_permission_grant" },
            { action: "security.personal_permission_allow" },
            { action: "security.personal_permission_deny" },
            { action: "security.personal_permission_inherit" },
          ],
        },
      })
    ).toHaveLength(4);

    await prisma.rolePermission.create({
      data: { role: "MEMBER", permissionKey: STALE_PERMISSION },
    });
    const staleUser = await createUser(CASCADE_ID, "MEMBER");
    const staleContext = await loadPermissionContext(prisma, staleUser);
    expect(staleContext.roleGrants.has(TEST_PERMISSION)).toBe(false);
    expect(hasEffectivePermission(staleContext, STALE_PERMISSION)).toBe(false);
    expect(hasEffectivePermission(staleContext, "toString")).toBe(false);
  });

  it("allows only Owner security writes and persists their audit events", async () => {
    const prisma = await getVerifiedTestPrisma();
    const admin = await createUser(ADMIN_ID, "ADMINISTRATOR");
    const member = await createUser(MEMBER_ID, "MEMBER");

    await expect(
      setRolePermission(
        prisma,
        admin.id,
        "CONTRIBUTOR",
        TEST_PERMISSION,
        true
      )
    ).rejects.toMatchObject({ code: "permission_denied" });
    await expect(
      setUserPermissionOverride(
        prisma,
        admin.id,
        member.id,
        TEST_PERMISSION,
        "ALLOW"
      )
    ).rejects.toMatchObject({ code: "permission_denied" });
    await expect(
      setUserPermissionOverride(
        prisma,
        ownerId,
        member.id,
        PROTECTED_PERMISSION_KEYS[0],
        "ALLOW"
      )
    ).rejects.toMatchObject({ code: "protected_permission" });
    await expect(
      setRolePermission(prisma, ownerId, "MEMBER", "toString", true)
    ).rejects.toMatchObject({ code: "invalid_permission" });

    expect(
      await prisma.rolePermission.count({
        where: { role: "CONTRIBUTOR", permissionKey: TEST_PERMISSION },
      })
    ).toBe(0);
    expect(
      await prisma.userPermissionOverride.count({
        where: { userId: member.id },
      })
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: {
          createdAt: { gte: RUN_STARTED_AT },
          targetId: member.id,
          action: { startsWith: "security." },
        },
      })
    ).toBe(0);
  });

  it("keeps generic role changes Owner-only and never assigns or demotes Owner", async () => {
    const prisma = await getVerifiedTestPrisma();
    const admin = await createUser(ADMIN_ID, "ADMINISTRATOR");
    const member = await createUser(MEMBER_ID, "MEMBER");

    await expect(
      changeUserRole(prisma, admin.id, member.id, "ADMINISTRATOR")
    ).rejects.toMatchObject({ code: "permission_denied" });
    await expect(
      changeUserRole(prisma, ownerId, member.id, "OWNER")
    ).rejects.toMatchObject({ code: "owner_protected" });
    await expect(
      changeUserRole(prisma, ownerId, ownerId, "MEMBER")
    ).rejects.toMatchObject({ code: "permission_denied" });

    await changeUserRole(prisma, ownerId, member.id, "CONTRIBUTOR");
    expect(
      await prisma.appUser.findUnique({
        where: { id: member.id },
        select: { role: true },
      })
    ).toEqual({ role: "CONTRIBUTOR" });
    expect(
      await prisma.auditEvent.count({
        where: {
          createdAt: { gte: RUN_STARTED_AT },
          action: "access.role_change",
          targetId: member.id,
        },
      })
    ).toBe(1);
    expect(
      await prisma.appUser.count({ where: { id: ownerId, role: "OWNER" } })
    ).toBe(1);
  });

  it("rolls back a security write and its audit event together", async () => {
    const prisma = await getVerifiedTestPrisma();

    await expect(
      prisma.$transaction(async (tx) => {
        await tx.rolePermission.create({
          data: { role: "MEMBER", permissionKey: TEST_PERMISSION },
        });
        await tx.auditEvent.create({
          data: {
            actorEmailSnapshot: "test-permission-rollback@example.com",
            action: "test.permission.rollback",
            targetType: "ROLE",
            targetId: "MEMBER",
            targetLabelSnapshot: "Member",
          },
        });
        throw new Error("force_rollback");
      })
    ).rejects.toThrow("force_rollback");

    expect(
      await prisma.rolePermission.count({
        where: { role: "MEMBER", permissionKey: TEST_PERMISSION },
      })
    ).toBe(0);
    expect(
      await prisma.auditEvent.count({
        where: { action: "test.permission.rollback" },
      })
    ).toBe(0);
  });
});
