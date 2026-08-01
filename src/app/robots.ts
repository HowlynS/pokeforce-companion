import type { MetadataRoute } from "next";
import { getSiteVisibility } from "@/lib/access/visibility";

export const dynamic = "force-dynamic";

export default async function robots(): Promise<MetadataRoute.Robots> {
  if ((await getSiteVisibility()) === "PRIVATE_BETA") {
    return { rules: { userAgent: "*", disallow: "/" } };
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/admin/", "/login", "/access-denied"],
    },
    ...(process.env.SITE_URL
      ? { sitemap: `${process.env.SITE_URL.replace(/\/$/, "")}/sitemap.xml` }
      : {}),
  };
}
