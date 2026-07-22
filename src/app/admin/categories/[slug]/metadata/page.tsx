import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import {
  categoryEditHref,
  normalizeCategorySearchQuery,
} from "@/lib/admin/category-workspace";

export const dynamic = "force-dynamic";

// The Metadata tab was removed in the Visual Pass (sub-slice 4): its one
// fact (Item count) is already shown by the Items tab's own count, and
// Timestamps duplicates General's own aside. Old direct links/bookmarks
// to this route redirect safely to General instead of 404ing, preserving
// the active search query; an unknown slug still ends up 404ing, via the
// General edit page's own notFound() check.
type CategoryMetadataRedirectPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function CategoryMetadataRedirectPage({
  params,
  searchParams,
}: CategoryMetadataRedirectPageProps) {
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;

  redirect(categoryEditHref(slug, normalizeCategorySearchQuery(q)));
}
