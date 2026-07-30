import type { PrismaClient } from "@/generated/prisma/client";
import { SITE_APPEARANCE_ID } from "@/lib/appearance/defaults";

export type SiteAppearanceWrite = {
  headerLogoPath: string | null;
  headerLogoWidth: number | null;
  headerLogoHeight: number | null;
  faviconPath: string | null;
  faviconWidth: number | null;
  faviconHeight: number | null;
  homeBackgroundPath: string | null;
  homeBackgroundWidth: number | null;
  homeBackgroundHeight: number | null;
  homeDesktopPositionX: number | null;
  homeDesktopPositionY: number | null;
  homeMobilePositionX: number | null;
  homeMobilePositionY: number | null;
  catalogueBackgroundPath: string | null;
  catalogueBackgroundWidth: number | null;
  catalogueBackgroundHeight: number | null;
  catalogueDesktopPositionX: number | null;
  catalogueDesktopPositionY: number | null;
  catalogueMobilePositionX: number | null;
  catalogueMobilePositionY: number | null;
  itemDetailBackgroundPath: string | null;
  itemDetailBackgroundWidth: number | null;
  itemDetailBackgroundHeight: number | null;
  itemDetailDesktopPositionX: number | null;
  itemDetailDesktopPositionY: number | null;
  itemDetailMobilePositionX: number | null;
  itemDetailMobilePositionY: number | null;
  adminBackgroundPath: string | null;
  adminBackgroundWidth: number | null;
  adminBackgroundHeight: number | null;
  adminDesktopPositionX: number | null;
  adminDesktopPositionY: number | null;
};

/**
 * Publishes one complete appearance snapshot in one database transaction.
 * Callers upload replacement objects before this call and only clean previous
 * objects after it succeeds, so public state can never reference a missing
 * upload or expose a partially-updated group.
 */
export async function publishSiteAppearance(
  client: PrismaClient,
  value: SiteAppearanceWrite
) {
  return client.$transaction((transaction) =>
    transaction.siteAppearance.upsert({
      where: { id: SITE_APPEARANCE_ID },
      create: { id: SITE_APPEARANCE_ID, ...value },
      update: value,
    })
  );
}
