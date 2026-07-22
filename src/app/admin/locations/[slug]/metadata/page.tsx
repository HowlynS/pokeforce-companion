import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import {
  locationEditHref,
  normalizeLocationSearchQuery,
} from "@/lib/admin/location-workspace";

export const dynamic = "force-dynamic";

// The Metadata tab was removed in the Visual Pass (sub-slice 4):
// type/parent are already visible on General/Hierarchy, the
// sub-location and Acquisition Source counts are already shown by the
// Hierarchy and Acquisition Sources tabs' own counts, and Verification/
// Timestamps duplicate General's own aside. Old direct links/bookmarks
// to this route redirect safely to General instead of 404ing, preserving
// the active search query; an unknown slug still ends up 404ing, via the
// General edit page's own notFound() check.
type LocationMetadataRedirectPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function LocationMetadataRedirectPage({
  params,
  searchParams,
}: LocationMetadataRedirectPageProps) {
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;

  redirect(locationEditHref(slug, normalizeLocationSearchQuery(q)));
}
