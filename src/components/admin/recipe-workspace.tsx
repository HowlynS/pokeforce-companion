// The Recipe workspace wrapper (Slice 9C.1) — the SECOND production
// composition of the shared workspace pieces, following the Item
// workspace's precedent (src/components/admin/item-workspace.tsx)
// exactly: AdminWorkspace with the shared RecordList in its recordList
// slot and the page's own content in the primary region. This is
// deliberately the only Recipe-specific layer: it owns the Recipe list
// query (name/slug search, server-side, case-insensitive) and the Recipe
// URL construction (via the pure helpers in
// src/lib/admin/recipe-workspace.ts); the shared components underneath
// stay resource-agnostic. Not a generic resource-query framework — this
// is a second, independent thin wrapper, not a shared base class.

import { prisma } from "@/lib/db";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import { getImagePublicUrl } from "@/lib/storage/images";
import {
  RECIPE_CREATE_PATH,
  RECIPE_LIST_PATH,
  recipeEditHref,
  normalizeRecipeSearchQuery,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";

type RecipeWorkspaceProps = {
  /** Raw ?q= value from the page's searchParams; normalized here. */
  rawQuery?: string;
  /** Slug of the recipe open in the editor (edit/ingredients/delete
      routes) — marks the selected row. Landing and create pages pass
      nothing. */
  selectedSlug?: string;
  /** The page's header region (PageHeader plus any toolbar/banners). */
  header: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form, or
      delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel — image/verification/timestamps
      panels on the General editor; unused elsewhere. */
  aside?: React.ReactNode;
  /** Builds each record row's link (Slice 9C.3) — defaults to the
      General edit route. The Ingredients route passes
      `recipeIngredientsHref` so quick switching between recipes while on
      that tab opens the next recipe's Ingredients tab instead of
      dropping back to General. */
  recordHref?: (slug: string, query: string) => string;
};

export async function RecipeWorkspace({
  rawQuery,
  selectedSlug,
  header,
  children,
  aside,
  recordHref = recipeEditHref,
}: RecipeWorkspaceProps) {
  const query = normalizeRecipeSearchQuery(rawQuery);

  // Server-side filtering on name OR slug, case-insensitive — the same
  // trimmed-query posture the Item workspace and the global search use.
  // No query means the full list, alphabetical like the previous admin
  // table.
  const recipes = await prisma.recipe.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { resultingItem: true },
    orderBy: { name: "asc" },
  });

  // Resolved concurrently — image is already a scalar field on every row
  // from the query above (include only adds the resultingItem relation),
  // so this is pure URL construction, never a second database query.
  const imageUrls = await Promise.all(
    recipes.map((recipe) => getImagePublicUrl(recipe.image))
  );

  const rows = recipes.map((recipe, index) => ({
    href: recordHref(recipe.slug, query),
    primary: recipe.name,
    secondary: recipe.resultingItem.name,
    selected: recipe.slug === selectedSlug,
    image: imageUrls[index],
  }));

  const countLabel = query
    ? `${recipes.length} ${recipes.length === 1 ? "match" : "matches"}`
    : `${recipes.length} ${recipes.length === 1 ? "recipe" : "recipes"}`;

  return (
    <AdminWorkspace
      header={header}
      aside={aside}
      recordList={
        <RecordList
          label="Recipes"
          searchAction={RECIPE_LIST_PATH}
          searchValue={query}
          searchLabel="Search recipes"
          createHref={withRecipeSearchQuery(RECIPE_CREATE_PATH, query)}
          createLabel="+ New recipe"
          rows={rows}
          showImages
          countLabel={countLabel}
          empty={
            query ? (
              // Distinct no-match state: the applied query is shown, and
              // the list's own Clear link (rendered because a query is
              // active) is the way out.
              <p>No recipes match &ldquo;{query}&rdquo;.</p>
            ) : (
              <p>
                No recipes yet. Use &ldquo;+ New recipe&rdquo; to create the
                first one.
              </p>
            )
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
