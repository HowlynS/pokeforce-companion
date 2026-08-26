import { afterAll, afterEach, describe, expect, it } from "vitest";
import { resolveApplicationUserForIdentity } from "@/lib/auth/bootstrap-owner";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

const EMAIL = "test-owner-bootstrap@example.com";
const AUTH_USER_ID = "test-owner-bootstrap-auth-user";
const EXISTING_OWNER_ID = "test-owner-bootstrap-existing-owner";

async function cleanup() {
  const prisma = await getVerifiedTestPrisma();
  await prisma.auditEvent.deleteMany({
    where: {
      OR: [
        { actorEmailSnapshot: EMAIL },
        { targetLabelSnapshot: EMAIL },
        { targetId: AUTH_USER_ID },
      ],
    },
  });
  await prisma.appUser.deleteMany({
    where: {
      OR: [
        { email: EMAIL },
        { authUserId: AUTH_USER_ID },
        { id: EXISTING_OWNER_ID },
      ],
    },
  });
}

afterEach(cleanup);

afterAll(async () => {
  await cleanup();
  await disconnectTestPrisma();
});

describe("initial Owner bootstrap", () => {
  it("never provisions a non-matching authenticated account", async () => {
    const prisma = await getVerifiedTestPrisma();
    const user = await resolveApplicationUserForIdentity(
      prisma,
      { id: AUTH_USER_ID, email: EMAIL },
      "different-owner@example.com"
    );
    expect(user).toBeNull();
  });

  it("creates one active Owner and is idempotent", async () => {
    const prisma = await getVerifiedTestPrisma();
    const first = await resolveApplicationUserForIdentity(
      prisma,
      { id: AUTH_USER_ID, email: EMAIL.toUpperCase() },
      EMAIL
    );
    const second = await resolveApplicationUserForIdentity(
      prisma,
      { id: AUTH_USER_ID, email: EMAIL },
      EMAIL
    );

    expect(first?.id).toBe(second?.id);
    expect(first).toMatchObject({
      email: EMAIL,
      role: "OWNER",
      status: "ACTIVE",
    });
    expect(
      await prisma.appUser.count({ where: { authUserId: AUTH_USER_ID } })
    ).toBe(1);
  });

  it("serializes concurrent bootstrap attempts to one Owner", async () => {
    const prisma = await getVerifiedTestPrisma();
    const attempts = await Promise.all(
      Array.from({ length: 5 }, () =>
        resolveApplicationUserForIdentity(
          prisma,
          { id: AUTH_USER_ID, email: EMAIL },
          EMAIL
        )
      )
    );

    expect(new Set(attempts.map((user) => user?.id)).size).toBe(1);
    expect(
      await prisma.appUser.count({ where: { email: EMAIL } })
    ).toBe(1);
  });

  it("does not create a second Owner when ownership already exists", async () => {
    const prisma = await getVerifiedTestPrisma();
    await prisma.appUser.create({
      data: {
        id: EXISTING_OWNER_ID,
        authUserId: `${AUTH_USER_ID}-existing`,
        email: "test-owner-bootstrap-existing@example.com",
        role: "OWNER",
      },
    });

    await expect(
      resolveApplicationUserForIdentity(
        prisma,
        { id: AUTH_USER_ID, email: EMAIL },
        EMAIL
      )
    ).rejects.toThrow("owner_already_exists");
    expect(await prisma.appUser.count({ where: { role: "OWNER" } })).toBe(1);
  });
});
