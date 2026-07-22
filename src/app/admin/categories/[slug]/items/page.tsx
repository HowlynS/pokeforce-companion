import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import {
  categoryEditorTabs,
  categoryItemsHref,
  normalizeCategorySearchQuery,
} from "@/lib/admin/category-workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type CategoryItemsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

/**
 * The Item name cell: the link to the existing Item admin edit route,
 * plus an optional Base value detail line beneath it. Base value is
 * optional on an Item, so the detail line is omitted entirely when
 * absent, never a placeholder dash or an empty cell of its own — held
 * item and tradeable are boolean and always meaningful, so they get
 * their own columns instead.
 */
function ItemNameCell({
  slug,
  name,
  baseValue,
}: {
  slug: string;
  name: string;
  baseValue: number | null;
}) {
  return (
    <td>
      <a href={`/admin/items/${slug}/edit`} className="link-accent">
        {name}
      </a>
      {baseValue != null ? (
        <div className="admin-table-meta">
          <div>Base value: {baseValue}</div>
        </div>
      ) : null}
    </td>
  );
}

export default async function CategoryItemsPage({
  params,
  searchParams,
}: CategoryItemsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeCategorySearchQuery(q);

  // One restrained query: the Category's linked Items, ordered
  // alphabetically by name — no per-row follow-up query.
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      items: {
        orderBy: { name: "asc" },
      },
    },
  });

  if (!category) {
    notFound();
  }

  const tabs = categoryEditorTabs(category.slug, query, "items");
  const hasItems = category.items.length > 0;

  // The Items tab (Slice 9E.3): read-only, navigational content inside
  // the Category workspace — no inline item editing, no unlink control,
  // no create-item form. Every row links to the EXISTING Item admin edit
  // route.
  return (
    <CategoryWorkspace
      rawQuery={q}
      selectedSlug={category.slug}
      recordHref={categoryItemsHref}
      header={
        <>
          <EditorHeader
            eyebrow="Category"
            title={category.name}
            subtitle={category.slug}
          />

          <EditorTabs label="Category editor sections" tabs={tabs} />
        </>
      }
    >
      {!hasItems ? (
        <EmptyState
          title="No items use this category yet"
          description="Items linked to this category will appear here."
        />
      ) : (
        <ContextPanel
          title="Items"
          description={`${category.items.length} ${
            category.items.length === 1 ? "item" : "items"
          }`}
        >
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Item", "Held Item", "Tradeable"].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {category.items.map((item) => (
                  <tr key={item.id}>
                    <ItemNameCell
                      slug={item.slug}
                      name={item.name}
                      baseValue={item.baseValue}
                    />
                    <td>{item.heldItem ? "Yes" : "No"}</td>
                    <td>{item.tradeable ? "Yes" : "No"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ContextPanel>
      )}
    </CategoryWorkspace>
  );
}
