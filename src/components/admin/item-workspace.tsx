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
  /** The page's header region: EditorHeader/PageHeader plus tabs and
      toolbar/banners. */
  header: React.ReactNode;
  /** The page's main content (guidance state, create form, edit form,
      or delete confirmation). */
  children: React.ReactNode;
  /** Optional contextual side panel (Slice 9B.5: image, verification,
      timestamps) — passed straight through to AdminWorkspace's aside
      slot. Absent on the landing and delete-confirmation pages. */
  aside?: React.ReactNode;
};

export async function ItemWorkspace({
  rawQuery,
  selectedSlug,
  header,
  children,
  aside,
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

  const rows = items.map((item) => ({
    href: itemEditHref(item.slug, query),
    primary: item.name,
    secondary: item.category?.name ?? undefined,
    selected: item.slug === selectedSlug,
  }));

  const countLabel = query
    ? `${items.length} ${items.length === 1 ? "match" : "matches"}`
    : `${items.length} ${items.length === 1 ? "item" : "items"}`;

  return (
    <AdminWorkspace
      header={header}
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
          countLabel={countLabel}
          empty={
            query ? (
              // Distinct no-match state: the applied query is shown, and
              // the list's own Clear link (rendered because a query is
              // active) is the way out.
              <p style={{ margin: 0 }}>
                No items match &ldquo;{query}&rdquo;.
              </p>
            ) : (
              <p style={{ margin: 0 }}>
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
