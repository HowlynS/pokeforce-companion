// The Item workspace wrapper (Slice 9B.4) — the FIRST production
// composition of the shared workspace pieces: AdminWorkspace with the
// shared RecordList in its recordList slot and the page's own content in
// the primary region. This is deliberately the only Item-specific layer:
// it owns the Item list query (name/slug search, server-side,
// case-insensitive) and the Item URL construction (via the pure helpers
// in src/lib/admin/item-workspace.ts); the shared components underneath
// stay resource-agnostic, and the pages it wraps keep their existing
// forms, actions, and protections. Not a generic resource-query
// framework — when Recipes convert, they get their own thin wrapper.

import { prisma } from "@/lib/db";
import { AdminWorkspace } from "@/components/admin/admin-workspace";
import { RecordList } from "@/components/admin/record-list";
import { getImagePublicUrl } from "@/lib/storage/images";
import {
  ITEM_CREATE_PATH,
  ITEM_LIST_PATH,
  itemEditHref,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";

type ItemWorkspaceProps = {
  /** Raw ?q= value from the page's searchParams; normalized here. */
  rawQuery?: string;
  /** Slug of the item open in the editor (edit/delete routes) — marks
      the selected row. Landing and create pages pass nothing. */
  selectedSlug?: string;
  /** The page's header region: PageHeader plus any toolbar/banners for
      list/landing pages. Editor pages (create/edit/tab routes) no longer
      pass this — their own EditorHeader/EditorTabs/error content now
      renders as the first children instead (Visual Pass II Section 3). */
  header?: React.ReactNode;
  /** The selected item's own EditorHeader/EditorTabs/error banner
      (Visual Pass II correction pass, Section 3) — passed straight
      through to AdminWorkspace's editorHeader slot, so it renders above
      the main-card/aside row instead of at the top of `children`. */
  editorHeader?: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form,
      or delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel (Slice 9B.5: image, verification,
      timestamps) — passed straight through to AdminWorkspace's aside
      slot. Absent on the landing and delete-confirmation pages. */
  aside?: React.ReactNode;
  /** Builds each record row's link (Slice 9B.6) — defaults to the
      General edit route. Acquisition Sources routes pass
      `itemSourcesHref` so quick switching between items stays on the
      Acquisition Sources tab instead of dropping back to General. */
  recordHref?: (slug: string, query: string) => string;
};

export async function ItemWorkspace({
  rawQuery,
  selectedSlug,
  header,
  editorHeader,
  children,
  aside,
  recordHref = itemEditHref,
}: ItemWorkspaceProps) {
  const query = normalizeItemSearchQuery(rawQuery);

  // Server-side filtering on name OR slug, case-insensitive — the same
  // trimmed-query posture the global search uses. No query means the
  // full list, alphabetical like the previous admin table.
  const items = await prisma.item.findMany({
    where: query
      ? {
          OR: [
            { name: { contains: query, mode: "insensitive" } },
            { slug: { contains: query, mode: "insensitive" } },
          ],
        }
      : undefined,
    include: { category: true },
    orderBy: { name: "asc" },
  });

  // Resolved concurrently — image is already a scalar field on every row
  // from the query above (include only adds the category relation), so
  // this is pure URL construction, never a second database query.
  const imageUrls = await Promise.all(
    items.map((item) => getImagePublicUrl(item.image))
  );

  const rows = items.map((item, index) => ({
    href: recordHref(item.slug, query),
    primary: item.name,
    secondary: item.category?.name ?? undefined,
    selected: item.slug === selectedSlug,
    image: imageUrls[index],
  }));

  const countLabel = query
    ? `${items.length} ${items.length === 1 ? "match" : "matches"}`
    : `${items.length} ${items.length === 1 ? "item" : "items"}`;

  return (
    <AdminWorkspace
      header={header}
      editorHeader={editorHeader}
      aside={aside}
      recordList={
        <RecordList
          label="Items"
          searchAction={ITEM_LIST_PATH}
          searchValue={query}
          searchLabel="Search items"
          createHref={withItemSearchQuery(ITEM_CREATE_PATH, query)}
          createLabel="+ New item"
          rows={rows}
          showImages
          countLabel={countLabel}
          empty={
            query ? (
              // Distinct no-match state: the applied query is shown, and
              // the list's own Clear link (rendered because a query is
              // active) is the way out.
              <p>No items match &ldquo;{query}&rdquo;.</p>
            ) : (
              <p>
                No items yet. Use &ldquo;+ New item&rdquo; to create the
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
