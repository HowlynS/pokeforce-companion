import { afterAll, afterEach, describe, expect, it } from "vitest";
import { changeUserRole, setUserStatus, UserManagementError } from "@/lib/users/service";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

const USERS = [
  { id: "test-user-owner-a", authUserId: "test-user-auth-owner-a", email: "test-user-owner-a@example.com" },
  { id: "test-user-owner-b", authUserId: "test-user-auth-owner-b", email: "test-user-owner-b@example.com" },
  { id: "test-user-admin", authUserId: "test-user-auth-admin", email: "test-user-admin@example.com" },
  { id: "test-user-member", authUserId: "test-user-auth-member", email: "test-user-member@example.com" },
] as const;

async function cleanup() {
  const prisma = await getVerifiedTestPrisma();
  await prisma.auditEvent.deleteMany({
    where: { targetId: { in: USERS.map((user) => user.id) } },
  });
  await prisma.appUser.deleteMany({ where: { id: { in: USERS.map((user) => user.id) } } });
}

async function seed() {
  const prisma = await getVerifiedTestPrisma();
  await cleanup();
  await prisma.appUser.createMany({
    data: [
      { ...USERS[0], role: "OWNER" },
      { ...USERS[1], role: "CONTRIBUTOR" },
      { ...USERS[2], role: "ADMINISTRATOR" },
      { ...USERS[3], role: "MEMBER" },
    ],
  });
  return prisma;
}

afterEach(cleanup);
afterAll(async () => {
  await cleanup();
  await disconnectTestPrisma();
});

describe("user management invariants", () => {
  it("prevents an Administrator from disabling a Member", async () => {
    const prisma = await seed();
    await expect(
      setUserStatus(prisma, USERS[2].id, USERS[3].id, "DISABLED")
    ).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("prevents an Administrator from modifying an Owner", async () => {
    const prisma = await seed();
    await expect(
      changeUserRole(prisma, USERS[2].id, USERS[0].id, "MEMBER")
    ).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("allows the Owner to assign an ordinary role", async () => {
    const prisma = await seed();
    const updated = await changeUserRole(
      prisma,
      USERS[0].id,
      USERS[1].id,
      "ADMINISTRATOR"
    );
    expect(updated.role).toBe("ADMINISTRATOR");
  });

  it("generic role and status APIs cannot alter or create an Owner", async () => {
    const prisma = await seed();
    await expect(
      changeUserRole(prisma, USERS[0].id, USERS[1].id, "OWNER")
    ).rejects.toBeInstanceOf(UserManagementError);
    await expect(
      changeUserRole(prisma, USERS[0].id, USERS[0].id, "ADMINISTRATOR")
    ).rejects.toBeInstanceOf(UserManagementError);
    await expect(
      setUserStatus(prisma, USERS[0].id, USERS[0].id, "DISABLED")
    ).rejects.toBeInstanceOf(UserManagementError);
    expect(
      await prisma.appUser.count({ where: { role: "OWNER", status: "ACTIVE" } })
    ).toBeGreaterThanOrEqual(1);
  });
});
