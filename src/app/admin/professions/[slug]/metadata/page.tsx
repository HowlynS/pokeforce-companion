import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import {
  normalizeProfessionSearchQuery,
  professionEditHref,
} from "@/lib/admin/profession-workspace";

export const dynamic = "force-dynamic";

// The Metadata tab was removed in the Visual Pass (sub-slice 4): its one
// fact (Recipe count) is already shown by the Recipes tab's own count,
// and Verification/Timestamps duplicate General's own aside. Old direct
// links/bookmarks to this route redirect safely to General instead of
// 404ing, preserving the active search query; an unknown slug still ends
// up 404ing, via the General edit page's own notFound() check.
type ProfessionMetadataRedirectPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function ProfessionMetadataRedirectPage({
  params,
  searchParams,
}: ProfessionMetadataRedirectPageProps) {
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;

  redirect(professionEditHref(slug, normalizeProfessionSearchQuery(q)));
}
