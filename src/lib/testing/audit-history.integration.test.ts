import { afterAll, afterEach, describe, expect, it } from "vitest";
import { changeSiteVisibility } from "@/lib/access/visibility-service";
import { TEST_SITE_VISIBILITY_BASELINE } from "@/lib/testing/site-visibility-baseline";
import { writeContentAudit } from "@/lib/audit/content";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

const OWNER_ID = "test-audit-owner";
const AUTH_ID = "test-audit-owner-auth";
const EMAIL = "test-audit-owner@example.com";

/**
 * Resets this suite's own records and restores PRIVATE_BETA, which is a
 * PRECONDITION these tests need rather than a resting state: the audit
 * assertion below expects `previous: "PRIVATE_BETA"` when the visibility
 * change is recorded.
 */
async function cleanup() {
  const prisma = await getVerifiedTestPrisma();
  await prisma.auditEvent.deleteMany({
    where: { OR: [{ actorUserId: OWNER_ID }, { targetId: OWNER_ID }] },
  });
  await prisma.appUser.deleteMany({ where: { id: OWNER_ID } });
  await prisma.siteAccessSettings.update({
    where: { id: "site" },
    data: { visibility: "PRIVATE_BETA" },
  });
}

afterEach(cleanup);
afterAll(async () => {
  await cleanup();
  // Site visibility is a singleton shared with the browser suite, so this
  // suite must not finish holding its own precondition — leaving
  // PRIVATE_BETA behind is exactly the leak that used to redirect public
  // E2E specs to /login. Hand the database back at the documented baseline.
  const prisma = await getVerifiedTestPrisma();
  await prisma.siteAccessSettings.update({
    where: { id: "site" },
    data: { visibility: TEST_SITE_VISIBILITY_BASELINE },
  });
  await disconnectTestPrisma();
});

describe("append-only administrative audit history", () => {
  it("writes visibility change and audit event in one transaction", async () => {
    const prisma = await getVerifiedTestPrisma();
    await cleanup();
    await prisma.appUser.create({
      data: { id: OWNER_ID, authUserId: AUTH_ID, email: EMAIL, role: "OWNER" },
    });

    await changeSiteVisibility(prisma, OWNER_ID, "PUBLIC");
    expect(
      await prisma.siteAccessSettings.findUnique({ where: { id: "site" } })
    ).toMatchObject({ visibility: "PUBLIC" });
    const event = await prisma.auditEvent.findFirst({
      where: { actorUserId: OWNER_ID, action: "access.visibility_change" },
    });
    expect(event).toMatchObject({
      targetType: "SITE_VISIBILITY",
      actorEmailSnapshot: EMAIL,
    });
    expect(event?.metadata).toEqual({ previous: "PRIVATE_BETA", next: "PUBLIC" });
  });

  it("records a representative gameplay change without form values", async () => {
    const prisma = await getVerifiedTestPrisma();
    await cleanup();
    const actor = await prisma.appUser.create({
      data: { id: OWNER_ID, authUserId: AUTH_ID, email: EMAIL, role: "OWNER" },
    });
    const formData = new FormData();
    formData.set("name", "Sensitive draft name");
    formData.set("descriptionRich", "Unpublished rich text");
    formData.set("markVerified", "on");

    await writeContentAudit(prisma, {
      actor,
      operation: "edit",
      targetType: "ITEM",
      targetId: "test-audit-item",
      targetLabel: "Representative item",
      formData,
    });

    const event = await prisma.auditEvent.findFirstOrThrow({
      where: { actorUserId: OWNER_ID, action: "gameplay.edit" },
    });
    expect(event.metadata).toEqual({
      changedArea: "general",
      submittedFields: ["name", "markVerified"],
      contentChanged: true,
      verificationRequested: true,
    });
    expect(JSON.stringify(event.metadata)).not.toContain("Sensitive draft");
    expect(JSON.stringify(event.metadata)).not.toContain("Unpublished");
  });
});
