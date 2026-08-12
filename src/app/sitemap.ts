import type { MetadataRoute } from "next";
import { getSiteVisibility } from "@/lib/access/visibility";

export const dynamic = "force-dynamic";

const PUBLIC_INDEX_PATHS = [
  "",
  "/items",
  "/recipes",
  "/professions",
  "/classes",
  "/categories",
  "/world",
  "/locations",
  "/shops",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const baseUrl = process.env.SITE_URL?.replace(/\/$/, "");
  if ((await getSiteVisibility()) === "PRIVATE_BETA" || !baseUrl) {
    return [];
  }
  return PUBLIC_INDEX_PATHS.map((path) => ({ url: `${baseUrl}${path}` }));
}
