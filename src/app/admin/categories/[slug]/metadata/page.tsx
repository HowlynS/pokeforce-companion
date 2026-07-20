import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import {
  CATEGORY_LIST_PATH,
  categoryEditorTabs,
  categoryMetadataHref,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type CategoryMetadataPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function CategoryMetadataPage({
  params,
  searchParams,
}: CategoryMetadataPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeCategorySearchQuery(q);

  // One restrained query: an Item _count (never the full `items`
  // relation, which the Items tab already covers) — Categories carry no
  // verification stamp, so no gameVersions query is needed here, unlike
  // Item/Recipe/Profession's own Metadata tabs.
  const category = await prisma.category.findUnique({
    where: { slug },
    include: {
      _count: { select: { items: true } },
    },
  });

  if (!category) {
    notFound();
  }

  const tabs = categoryEditorTabs(category.slug, query, "metadata");

  // The Metadata tab (Slice 9E.4, completing the Category workspace):
  // read-only administrative information only — no form, no checkbox,
  // no delete action, no image or Item-relationship controls. Categories
  // have no image or gameplay-verification behavior, so this tab is
  // deliberately LEANER than Item/Recipe/Profession's own Metadata tabs:
  // no VerificationPanel, no ImagePanel, no GameVersionVerificationControls.
  // TimestampsPanel supplies created/updated dates; it never surfaces the
  // record's database id or other internal details. The Category's own
  // slug is already visible via the header subtitle, exactly as on every
  // other Category tab. The description field is deliberately NOT
  // repeated here — it is an editable General field, and this tab exists
  // to show administrative facts General doesn't, not to duplicate it.
  // The Category context panel below adds the one relational fact useful
  // here — the Item count, via `_count` (never the full `items`
  // relation) — which always renders, since zero is itself meaningful
  // administrative context.
  return (
    <CategoryWorkspace
      rawQuery={q}
      selectedSlug={category.slug}
      recordHref={categoryMetadataHref}
      header={
        <>
          <EditorHeader
            title={category.name}
            subtitle={category.slug}
            backHref={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
            backLabel="Back to Category Management"
          />

          <EditorTabs label="Category editor sections" tabs={tabs} />
        </>
      }
    >
      <ContextPanel title="Category">
        <dl className="admin-panel-dl">
          <div className="admin-panel-row">
            <dt>Items</dt>
            <dd>{category._count.items}</dd>
          </div>
        </dl>
      </ContextPanel>

      <TimestampsPanel
        createdAt={category.createdAt}
        updatedAt={category.updatedAt}
      />
    </CategoryWorkspace>
  );
}
