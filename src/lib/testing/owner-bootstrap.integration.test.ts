import { afterAll, afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveApplicationUserForIdentity } from "@/lib/auth/bootstrap-owner";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

const EMAIL = "test-owner-bootstrap@example.com";
const AUTH_USER_ID = "test-owner-bootstrap-auth-user";
const EXISTING_OWNER_ID = "test-owner-bootstrap-existing-owner";

let preservedOwnerIds: string[] = [];

beforeEach(async () => {
  const prisma = await getVerifiedTestPrisma();
  const configuredOwnerEmail = process.env.ADMIN_EMAIL?.trim().toLowerCase();

  // Recover safely if an earlier test process was killed after the temporary
  // demotion but before cleanup could restore the persistent test Owner.
  if (configuredOwnerEmail) {
    await prisma.appUser.updateMany({
      where: { email: configuredOwnerEmail },
      data: { role: "OWNER" },
    });
  }

  const owners = await prisma.appUser.findMany({
    where: { role: "OWNER" },
    select: { id: true },
  });
  preservedOwnerIds = owners.map(({ id }) => id);

  // The isolated test project intentionally retains its real test Owner.
  // Bootstrap scenarios need the pre-Owner state, so temporarily move only
  // those preserved fixtures to an ordinary role and restore them in cleanup.
  if (preservedOwnerIds.length > 0) {
    await prisma.appUser.updateMany({
      where: { id: { in: preservedOwnerIds } },
      data: { role: "ADMINISTRATOR" },
    });
  }
});

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

  if (preservedOwnerIds.length > 0) {
    await prisma.appUser.updateMany({
      where: { id: { in: preservedOwnerIds } },
      data: { role: "OWNER" },
    });
    preservedOwnerIds = [];
  }
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
