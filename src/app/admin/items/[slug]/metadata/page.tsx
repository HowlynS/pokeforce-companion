import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import {
  itemEditHref,
  normalizeItemSearchQuery,
} from "@/lib/admin/item-workspace";

export const dynamic = "force-dynamic";

// The Metadata tab was removed in the Visual Pass (sub-slice 4): every
// fact it showed (Verification, Timestamps) is already duplicated on
// General's own aside. Old direct links/bookmarks to this route redirect
// safely to General instead of 404ing, preserving the active search
// query; an unknown slug still ends up 404ing, via the General edit
// page's own notFound() check.
type ItemMetadataRedirectPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function ItemMetadataRedirectPage({
  params,
  searchParams,
}: ItemMetadataRedirectPageProps) {
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;

  redirect(itemEditHref(slug, normalizeItemSearchQuery(q)));
}
