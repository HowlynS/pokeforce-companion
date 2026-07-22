import { redirect } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import {
  normalizeRecipeSearchQuery,
  recipeEditHref,
} from "@/lib/admin/recipe-workspace";

export const dynamic = "force-dynamic";

// The Metadata tab was removed in the Visual Pass (sub-slice 4): its
// resulting-item/profession/required-level facts are already on General,
// the ingredient count is visible on Ingredients, and Verification/
// Timestamps duplicate General's own aside. Old direct links/bookmarks
// to this route redirect safely to General instead of 404ing, preserving
// the active search query; an unknown slug still ends up 404ing, via the
// General edit page's own notFound() check.
type RecipeMetadataRedirectPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function RecipeMetadataRedirectPage({
  params,
  searchParams,
}: RecipeMetadataRedirectPageProps) {
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;

  redirect(recipeEditHref(slug, normalizeRecipeSearchQuery(q)));
}
