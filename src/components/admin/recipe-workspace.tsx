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
  /** The page's header region (PageHeader plus any toolbar/banners) for
      list/landing pages. Editor pages (create/edit/tab routes) no longer
      pass this — their own EditorHeader/EditorTabs/error content now
      renders as the first children instead (Visual Pass II Section 3). */
  header?: React.ReactNode;
  /** The selected recipe's own EditorHeader/EditorTabs/error banner
      (Visual Pass II correction pass, Section 3) — passed straight
      through to AdminWorkspace's editorHeader slot. */
  editorHeader?: React.ReactNode;
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
  editorHeader,
  children,
  aside,
  recordHref = recipeEditHref,
}: RecipeWorkspaceProps) {
  const query = normalizeRecipeSearchQuery(rawQuery);

  // The COMPLETE list, always — filtering is now instant and client-side
  // (Phase B1, System A), so there is no server-side `where`/`q` filter
  // and no pagination `skip`/`take` here at all. Alphabetical, matching
  // the previous admin table's own ordering.
  const recipes = await prisma.recipe.findMany({
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
    slug: recipe.slug,
    secondary: recipe.resultingItem.name,
    selected: recipe.slug === selectedSlug,
    image: imageUrls[index],
  }));

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Recipes"
          listPath={RECIPE_LIST_PATH}
          initialQuery={query}
          searchLabel="Search recipes"
          createHref={withRecipeSearchQuery(RECIPE_CREATE_PATH, query)}
          createLabel="+ New recipe"
          rows={rows}
          showImages
          noun={{ singular: "recipe", plural: "recipes" }}
          empty={
            <p>
              No recipes yet. Use &ldquo;+ New recipe&rdquo; to create the
              first one.
            </p>
          }
        />
      }
    >
      {children}
    </AdminWorkspace>
  );
}
