import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { DEFAULT_SITE_APPEARANCE, SITE_APPEARANCE_ID } from "@/lib/appearance/defaults";
import {
  publishSiteAppearance,
  type SiteAppearanceWrite,
} from "@/lib/appearance/service";
import {
  disconnectTestPrisma,
  getVerifiedTestPrisma,
} from "@/lib/testing/integration-database";

const EMPTY_APPEARANCE: SiteAppearanceWrite = {
  headerLogoPath: null,
  headerLogoWidth: null,
  headerLogoHeight: null,
  faviconPath: null,
  faviconWidth: null,
  faviconHeight: null,
  homeBackgroundPath: null,
  homeBackgroundWidth: null,
  homeBackgroundHeight: null,
  homeDesktopPositionX: DEFAULT_SITE_APPEARANCE.home.desktop.x,
  homeDesktopPositionY: DEFAULT_SITE_APPEARANCE.home.desktop.y,
  homeMobilePositionX: DEFAULT_SITE_APPEARANCE.home.mobile.x,
  homeMobilePositionY: DEFAULT_SITE_APPEARANCE.home.mobile.y,
  catalogueBackgroundPath: null,
  catalogueBackgroundWidth: null,
  catalogueBackgroundHeight: null,
  catalogueDesktopPositionX: DEFAULT_SITE_APPEARANCE.catalogue.desktop.x,
  catalogueDesktopPositionY: DEFAULT_SITE_APPEARANCE.catalogue.desktop.y,
  catalogueMobilePositionX: DEFAULT_SITE_APPEARANCE.catalogue.mobile.x,
  catalogueMobilePositionY: DEFAULT_SITE_APPEARANCE.catalogue.mobile.y,
  itemDetailBackgroundPath: null,
  itemDetailBackgroundWidth: null,
  itemDetailBackgroundHeight: null,
  itemDetailDesktopPositionX: DEFAULT_SITE_APPEARANCE.itemDetail.desktop.x,
  itemDetailDesktopPositionY: DEFAULT_SITE_APPEARANCE.itemDetail.desktop.y,
  itemDetailMobilePositionX: DEFAULT_SITE_APPEARANCE.itemDetail.mobile.x,
  itemDetailMobilePositionY: DEFAULT_SITE_APPEARANCE.itemDetail.mobile.y,
  adminBackgroundPath: null,
  adminBackgroundWidth: null,
  adminBackgroundHeight: null,
  adminDesktopPositionX: DEFAULT_SITE_APPEARANCE.admin.desktop.x,
  adminDesktopPositionY: DEFAULT_SITE_APPEARANCE.admin.desktop.y,
};

async function removeTestSingleton() {
  const prisma = await getVerifiedTestPrisma();
  await prisma.siteAppearance.deleteMany({
    where: { id: SITE_APPEARANCE_ID },
  });
}

describe("site appearance singleton (integration)", () => {
  beforeAll(removeTestSingleton);
  afterEach(removeTestSingleton);
  afterAll(async () => {
    await removeTestSingleton();
    await disconnectTestPrisma();
  });

  it("creates and updates the same fixed singleton atomically", async () => {
    const prisma = await getVerifiedTestPrisma();

    const created = await publishSiteAppearance(prisma, {
      ...EMPTY_APPEARANCE,
      homeDesktopPositionX: 42,
      adminDesktopPositionX: 38,
    });
    expect(created.id).toBe(SITE_APPEARANCE_ID);
    expect(created.homeDesktopPositionX).toBe(42);
    expect(created.adminDesktopPositionX).toBe(38);

    const updated = await publishSiteAppearance(prisma, {
      ...EMPTY_APPEARANCE,
      headerLogoPath: "appearance/header-logo/test.png",
      headerLogoWidth: 900,
      headerLogoHeight: 300,
      homeDesktopPositionX: 67,
      adminBackgroundPath: "appearance/admin-background/test.webp",
      adminBackgroundWidth: 1920,
      adminBackgroundHeight: 1080,
    });
    expect(updated.id).toBe(SITE_APPEARANCE_ID);
    expect(updated.headerLogoPath).toBe("appearance/header-logo/test.png");
    expect(updated.homeDesktopPositionX).toBe(67);
    expect(updated.adminBackgroundPath).toBe(
      "appearance/admin-background/test.webp"
    );
    expect(await prisma.siteAppearance.count()).toBe(1);
  });

  it("rolls the complete snapshot back when the transaction fails", async () => {
    const prisma = await getVerifiedTestPrisma();
    await publishSiteAppearance(prisma, {
      ...EMPTY_APPEARANCE,
      catalogueDesktopPositionY: 64,
    });

    await expect(
      prisma.$transaction(async (transaction) => {
        await transaction.siteAppearance.update({
          where: { id: SITE_APPEARANCE_ID },
          data: {
            catalogueDesktopPositionY: 12,
            itemDetailBackgroundPath: "appearance/item-detail/test.webp",
          },
        });
        throw new Error("simulated publication failure");
      })
    ).rejects.toThrow("simulated publication failure");

    const published = await prisma.siteAppearance.findUnique({
      where: { id: SITE_APPEARANCE_ID },
    });
    expect(published?.catalogueDesktopPositionY).toBe(64);
    expect(published?.itemDetailBackgroundPath).toBeNull();
  });
});
