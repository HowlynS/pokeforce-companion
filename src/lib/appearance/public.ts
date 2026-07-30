import "server-only";

import { unstable_cache } from "next/cache";
import { prisma } from "@/lib/db";
import { IMAGE_BUCKET } from "@/lib/storage/images";
import {
  DEFAULT_SITE_APPEARANCE,
  SITE_APPEARANCE_CACHE_TAG,
  SITE_APPEARANCE_ID,
  resolveSiteAppearance,
  type ResolvedSiteAppearance,
} from "@/lib/appearance/defaults";

export async function getAppearanceAssetPublicUrl(
  objectPath: string
): Promise<string | null> {
  const projectUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/+$/, "");
  if (!projectUrl) {
    return null;
  }
  const encodedPath = objectPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");
  return `${projectUrl}/storage/v1/object/public/${IMAGE_BUCKET}/${encodedPath}`;
}

const loadPublishedSiteAppearance = unstable_cache(
  async (): Promise<ResolvedSiteAppearance> => {
    try {
      const record = await prisma.siteAppearance.findUnique({
        where: { id: SITE_APPEARANCE_ID },
      });
      // Pure public URL construction is deliberate here. The cookie-aware
      // Supabase server client reads request headers and cannot be called
      // inside a persistent cache scope; public object URLs need no session.
      return await resolveSiteAppearance(record, getAppearanceAssetPublicUrl);
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
  ["published-site-appearance-v2"],
  { tags: [SITE_APPEARANCE_CACHE_TAG] }
);

export async function getPublishedSiteAppearance(): Promise<ResolvedSiteAppearance> {
  return loadPublishedSiteAppearance();
}
