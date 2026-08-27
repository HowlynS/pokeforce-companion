import type { Prisma, PrismaClient } from "@/generated/prisma/client";
import { describe, expect, it } from "vitest";
import {
  PermissionManagementError,
  setRolePermission,
  setUserPermissionOverride,
} from "./permission-management";

type FakeUser = {
  id: string;
  email: string;
  displayName: string | null;
  role: "MEMBER" | "CONTRIBUTOR" | "ADMINISTRATOR" | "OWNER";
  status: "ACTIVE" | "DISABLED";
};

function createFakeClient(options?: { failAudit?: boolean }) {
  const users = new Map<string, FakeUser>([
    [
      "owner-1",
      {
        id: "owner-1",
        email: "owner@example.com",
        displayName: "Owner",
        role: "OWNER",
        status: "ACTIVE",
      },
    ],
    [
      "admin-1",
      {
        id: "admin-1",
        email: "admin@example.com",
        displayName: "Admin",
        role: "ADMINISTRATOR",
        status: "ACTIVE",
      },
    ],
    [
      "member-1",
      {
        id: "member-1",
        email: "member@example.com",
        displayName: null,
        role: "MEMBER",
        status: "ACTIVE",
      },
    ],
  ]);
  let roleRows = new Set<string>();
  let overrideRows = new Map<string, "ALLOW" | "DENY">();
  let auditRows: Array<Record<string, unknown>> = [];

  const client = {
    $transaction: async (
      work: (tx: Prisma.TransactionClient) => Promise<unknown>
    ) => {
      const nextRoleRows = new Set(roleRows);
      const nextOverrideRows = new Map(overrideRows);
      const nextAuditRows = [...auditRows];
      const tx = {
        $executeRawUnsafe: async () => 0,
        appUser: {
          findUnique: async ({ where }: { where: { id: string } }) =>
            users.get(where.id) ?? null,
        },
        rolePermission: {
          findUnique: async ({
            where,
          }: {
            where: {
              role_permissionKey: { role: string; permissionKey: string };
            };
          }) => {
            const rowKey = `${where.role_permissionKey.role}:${where.role_permissionKey.permissionKey}`;
            return nextRoleRows.has(rowKey) ? { id: rowKey } : null;
          },
          create: async ({
            data,
          }: {
            data: { role: string; permissionKey: string };
          }) => {
            nextRoleRows.add(`${data.role}:${data.permissionKey}`);
            return data;
          },
          delete: async ({
            where,
          }: {
            where: {
              role_permissionKey: { role: string; permissionKey: string };
            };
          }) => {
            nextRoleRows.delete(
              `${where.role_permissionKey.role}:${where.role_permissionKey.permissionKey}`
            );
            return where;
          },
        },
        userPermissionOverride: {
          findUnique: async ({
            where,
          }: {
            where: {
              userId_permissionKey: { userId: string; permissionKey: string };
            };
          }) => {
            const rowKey = `${where.userId_permissionKey.userId}:${where.userId_permissionKey.permissionKey}`;
            const effect = nextOverrideRows.get(rowKey);
            return effect ? { effect } : null;
          },
          upsert: async ({
            create,
          }: {
            create: {
              userId: string;
              permissionKey: string;
              effect: "ALLOW" | "DENY";
            };
          }) => {
            nextOverrideRows.set(
              `${create.userId}:${create.permissionKey}`,
              create.effect
            );
            return create;
          },
          delete: async ({
            where,
          }: {
            where: {
              userId_permissionKey: { userId: string; permissionKey: string };
            };
          }) => {
            nextOverrideRows.delete(
              `${where.userId_permissionKey.userId}:${where.userId_permissionKey.permissionKey}`
            );
            return where;
          },
        },
        auditEvent: {
          create: async ({ data }: { data: Record<string, unknown> }) => {
            if (options?.failAudit) throw new Error("audit_failed");
            nextAuditRows.push(data);
            return data;
          },
        },
      } as unknown as Prisma.TransactionClient;

      const result = await work(tx);
      roleRows = nextRoleRows;
      overrideRows = nextOverrideRows;
      auditRows = nextAuditRows;
      return result;
    },
  } as unknown as PrismaClient;

  return {
    client,
    roleRows: () => roleRows,
    overrideRows: () => overrideRows,
    auditRows: () => auditRows,
  };
}

describe("Owner-only permission management", () => {
  it("atomically grants and audits an ordinary role permission", async () => {
    const fake = createFakeClient();
    await setRolePermission(
      fake.client,
      "owner-1",
      "CONTRIBUTOR",
      "content.items.edit",
      true
    );

    expect(fake.roleRows()).toContain(
      "CONTRIBUTOR:content.items.edit"
    );
    expect(fake.auditRows()).toHaveLength(1);
    expect(fake.auditRows()[0]?.action).toBe(
      "security.role_permission_grant"
    );
  });

  it("denies Administrators without writing grants or audit", async () => {
    const fake = createFakeClient();
    await expect(
      setRolePermission(
        fake.client,
        "admin-1",
        "ADMINISTRATOR",
        "content.items.edit",
        true
      )
    ).rejects.toMatchObject({ code: "permission_denied" });
    expect(fake.roleRows().size).toBe(0);
    expect(fake.auditRows()).toHaveLength(0);
  });

  it("rejects protected permissions and OWNER role rows", async () => {
    const fake = createFakeClient();
    await expect(
      setRolePermission(
        fake.client,
        "owner-1",
        "ADMINISTRATOR",
        "security.members.roles.manage",
        true
      )
    ).rejects.toBeInstanceOf(PermissionManagementError);
    await expect(
      setRolePermission(
        fake.client,
        "owner-1",
        "OWNER",
        "content.items.edit",
        true
      )
    ).rejects.toMatchObject({ code: "owner_protected" });
  });

  it("rejects arbitrary and prototype-inherited permission names", async () => {
    const fake = createFakeClient();
    await expect(
      setRolePermission(
        fake.client,
        "owner-1",
        "MEMBER",
        "toString",
        true
      )
    ).rejects.toMatchObject({ code: "invalid_permission" });
    await expect(
      setRolePermission(
        fake.client,
        "owner-1",
        "MEMBER",
        "content.items.edit",
        "true"
      )
    ).rejects.toMatchObject({ code: "invalid_grant" });
    expect(fake.roleRows().size).toBe(0);
  });

  it("stores ALLOW and DENY and represents INHERIT by deleting the row", async () => {
    const fake = createFakeClient();
    await setUserPermissionOverride(
      fake.client,
      "owner-1",
      "member-1",
      "content.items.edit",
      "ALLOW"
    );
    expect(fake.overrideRows().get("member-1:content.items.edit")).toBe(
      "ALLOW"
    );

    await setUserPermissionOverride(
      fake.client,
      "owner-1",
      "member-1",
      "content.items.edit",
      "DENY"
    );
    expect(fake.overrideRows().get("member-1:content.items.edit")).toBe(
      "DENY"
    );

    await setUserPermissionOverride(
      fake.client,
      "owner-1",
      "member-1",
      "content.items.edit",
      null
    );
    expect(fake.overrideRows().has("member-1:content.items.edit")).toBe(false);
    expect(fake.auditRows()).toHaveLength(3);
  });

  it("prevents non-Owners from changing their own override", async () => {
    const fake = createFakeClient();
    await expect(
      setUserPermissionOverride(
        fake.client,
        "admin-1",
        "admin-1",
        "content.items.edit",
        "ALLOW"
      )
    ).rejects.toMatchObject({ code: "permission_denied" });
    expect(fake.overrideRows().size).toBe(0);
  });

  it("rolls back the permission write when audit creation fails", async () => {
    const fake = createFakeClient({ failAudit: true });
    await expect(
      setRolePermission(
        fake.client,
        "owner-1",
        "MEMBER",
        "content.items.edit",
        true
      )
    ).rejects.toThrow("audit_failed");
    expect(fake.roleRows().size).toBe(0);
    expect(fake.auditRows()).toHaveLength(0);
  });
});
