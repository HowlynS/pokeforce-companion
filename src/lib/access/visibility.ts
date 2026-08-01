import "server-only";

import { cache } from "react";
import type { SiteVisibility } from "@/generated/prisma/enums";
import { prisma } from "@/lib/db";
import { SITE_ACCESS_SETTINGS_ID } from "@/lib/auth/bootstrap-owner";

export const FORCE_PRIVATE_ENV = "FORCE_PRIVATE_BETA";

export function isForcedPrivate(value: string | undefined): boolean {
  return value?.trim().toLowerCase() === "true";
}

export function resolveSiteVisibility(
  storedVisibility: SiteVisibility | null | undefined,
  forcedPrivateValue: string | undefined
): SiteVisibility {
  if (isForcedPrivate(forcedPrivateValue)) {
    return "PRIVATE_BETA";
  }
  return storedVisibility === "PUBLIC" ? "PUBLIC" : "PRIVATE_BETA";
}

// Per-request deduplication only. There is deliberately no cross-request
// cache: switching back to private takes effect on the next request.
export const getSiteVisibility = cache(async function getSiteVisibility() {
  const settings = await prisma.siteAccessSettings.findUnique({
    where: { id: SITE_ACCESS_SETTINGS_ID },
    select: { visibility: true },
  });
  return resolveSiteVisibility(
    settings?.visibility,
    process.env[FORCE_PRIVATE_ENV]
  );
});
