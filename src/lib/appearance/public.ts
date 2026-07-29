import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import {
  DEFAULT_SITE_APPEARANCE,
  SITE_APPEARANCE_CACHE_TAG,
  SITE_APPEARANCE_ID,
  resolveSiteAppearance,
  type ResolvedSiteAppearance,
} from "@/lib/appearance/defaults";

const loadPublishedSiteAppearance = unstable_cache(
  async (): Promise<ResolvedSiteAppearance> => {
    try {
      const record = await prisma.siteAppearance.findUnique({
        where: { id: SITE_APPEARANCE_ID },
      });
      return await resolveSiteAppearance(record, getImagePublicUrl);
    } catch (error) {
      // Public rendering must remain available during a missing migration,
      // transient database/storage failure, or malformed record. The custom
      // configuration is decoration; committed assets remain authoritative.
      console.error(
        "Could not resolve SiteAppearance; using committed defaults:",
        error instanceof Error ? error.message : "unknown error"
      );
      return DEFAULT_SITE_APPEARANCE;
    }
  },
  ["published-site-appearance"],
  { tags: [SITE_APPEARANCE_CACHE_TAG] }
);

export async function getPublishedSiteAppearance(): Promise<ResolvedSiteAppearance> {
  return loadPublishedSiteAppearance();
}
