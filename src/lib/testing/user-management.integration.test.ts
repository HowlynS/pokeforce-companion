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
      { ...USERS[1], role: "OWNER" },
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
  it("allows an Administrator to disable and re-enable a Member", async () => {
    const prisma = await seed();
    const disabled = await setUserStatus(prisma, USERS[2].id, USERS[3].id, "DISABLED");
    expect(disabled.status).toBe("DISABLED");
    expect(disabled.disabledById).toBe(USERS[2].id);

    const enabled = await setUserStatus(prisma, USERS[2].id, USERS[3].id, "ACTIVE");
    expect(enabled.status).toBe("ACTIVE");
    expect(enabled.disabledById).toBeNull();
  });

  it("prevents an Administrator from modifying an Owner", async () => {
    const prisma = await seed();
    await expect(
      changeUserRole(prisma, USERS[2].id, USERS[0].id, "MEMBER")
    ).rejects.toMatchObject({ code: "permission_denied" });
  });

  it("serializes concurrent Owner disables so one active Owner survives", async () => {
    const prisma = await seed();
    const outcomes = await Promise.allSettled([
      setUserStatus(prisma, USERS[0].id, USERS[1].id, "DISABLED"),
      setUserStatus(prisma, USERS[1].id, USERS[0].id, "DISABLED"),
    ]);

    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((result) => result.status === "rejected");
    expect((rejected as PromiseRejectedResult).reason).toBeInstanceOf(UserManagementError);
    expect(
      await prisma.appUser.count({ where: { role: "OWNER", status: "ACTIVE", id: { in: [USERS[0].id, USERS[1].id] } } })
    ).toBe(1);
  });

  it("serializes concurrent Owner demotions so one active Owner survives", async () => {
    const prisma = await seed();
    const outcomes = await Promise.allSettled([
      changeUserRole(prisma, USERS[0].id, USERS[1].id, "ADMINISTRATOR"),
      changeUserRole(prisma, USERS[1].id, USERS[0].id, "ADMINISTRATOR"),
    ]);
    expect(outcomes.filter((result) => result.status === "fulfilled")).toHaveLength(1);
    expect(
      await prisma.appUser.count({ where: { role: "OWNER", status: "ACTIVE", id: { in: [USERS[0].id, USERS[1].id] } } })
    ).toBe(1);
  });
});
