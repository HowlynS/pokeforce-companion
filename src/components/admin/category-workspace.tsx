// The Category workspace wrapper — the FOURTH production composition of
// the shared workspace pieces, following the Item
// (src/components/admin/item-workspace.tsx), Recipe
// (src/components/admin/recipe-workspace.tsx), and Profession
// (src/components/admin/profession-workspace.tsx) workspaces' precedent
// exactly: AdminWorkspace with the shared RecordList in its recordList
// slot and the page's own content in the primary region. This is
// deliberately the only Category-specific layer: it owns the Category
// list query (name/slug search, server-side, case-insensitive) and the
// Category URL construction (via the pure helpers in
// src/lib/admin/category-workspace.ts); the shared components underneath
// stay resource-agnostic. Not a generic resource-query framework — this
// is a fourth, independent thin wrapper, not a shared base class.
//
// Slice 9E.3 added the optional `recordHref` prop, mirroring
// `ProfessionWorkspace`'s own (Slice 9D.3): the Items tab route passes
// `categoryItemsHref` so quick switching stays on that tab.

import { prisma } from "@/lib/db";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import { getImagePublicUrl } from "@/lib/storage/images";
import {
  CATEGORY_CREATE_PATH,
  CATEGORY_LIST_PATH,
  categoryEditHref,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";

type CategoryWorkspaceProps = {
  /** Raw ?q= value from the page's searchParams; normalized here. */
  rawQuery?: string;
  /** Slug of the category open in the editor (edit/delete routes) —
      marks the selected row. Landing and create pages pass nothing. */
  selectedSlug?: string;
  /** The page's header region (PageHeader plus any toolbar/banners) for
      list/landing pages. Editor pages (create/edit/tab routes) no longer
      pass this — their own EditorHeader/EditorTabs/error content now
      renders as the first children instead (Visual Pass II Section 3). */
  header?: React.ReactNode;
  /** The selected category's own EditorHeader/EditorTabs/error banner
      (Visual Pass II correction pass, Section 3) — passed straight
      through to AdminWorkspace's editorHeader slot. */
  editorHeader?: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form, or
      delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel, unused in this pass — reserved for
      a later slice, matching the slot AdminWorkspace already exposes. */
  aside?: React.ReactNode;
  /** Builds each record row's link (Slice 9E.3) — defaults to the
      General edit route. The Items tab route passes `categoryItemsHref`
      so quick switching between categories stays on the Items tab
      instead of dropping back to General, mirroring
      `ProfessionWorkspace`'s own `recordHref` prop. */
  recordHref?: (slug: string, query: string) => string;
};

export async function CategoryWorkspace({
  rawQuery,
  selectedSlug,
  header,
  editorHeader,
  children,
  aside,
  recordHref = categoryEditHref,
}: CategoryWorkspaceProps) {
  const query = normalizeCategorySearchQuery(rawQuery);

  // Server-side filtering on name OR slug, case-insensitive — the same
  // trimmed-query posture the Item, Recipe, and Profession workspaces
  // use. No query means the full list, alphabetical like the previous
  // admin table. The item _count is loaded alongside (never the full
  // relation) so the secondary row context below never triggers an N+1
  // query.
  const categories = await prisma.category.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { _count: { select: { items: true } } },
    orderBy: { name: "asc" },
  });

  // Resolved concurrently — image is already a scalar field on every row
  // from the query above (include only adds the item _count), so this is
  // pure URL construction, never a second database query.
  const imageUrls = await Promise.all(
    categories.map((category) => getImagePublicUrl(category.image))
  );

  const rows = categories.map((category, index) => ({
    href: recordHref(category.slug, query),
    primary: category.name,
    secondary: `${category._count.items} ${
      category._count.items === 1 ? "item" : "items"
    }`,
    selected: category.slug === selectedSlug,
    image: imageUrls[index],
  }));

  const countLabel = query
    ? `${categories.length} ${categories.length === 1 ? "match" : "matches"}`
    : `${categories.length} ${
        categories.length === 1 ? "category" : "categories"
      }`;

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Categories"
          searchAction={CATEGORY_LIST_PATH}
          searchValue={query}
          searchLabel="Search categories"
          createHref={withCategorySearchQuery(CATEGORY_CREATE_PATH, query)}
          createLabel="+ New category"
          rows={rows}
          showImages
          countLabel={countLabel}
          empty={
            query ? (
              // Distinct no-match state: the applied query is shown, and
              // the list's own Clear link (rendered because a query is
              // active) is the way out.
              <p>No categories match &ldquo;{query}&rdquo;.</p>
            ) : (
              <p>
                No categories yet. Use &ldquo;+ New category&rdquo; to
                create the first one.
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
