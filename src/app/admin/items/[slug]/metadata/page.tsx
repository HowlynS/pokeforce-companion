import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import {
  ITEM_LIST_PATH,
  itemEditorTabs,
  itemMetadataHref,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ItemMetadataPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function ItemMetadataPage({
  params,
  searchParams,
}: ItemMetadataPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeItemSearchQuery(q);

  const [item, gameVersions] = await Promise.all([
    prisma.item.findUnique({
      where: { slug },
      // Admin-only visibility of the verification stamp, same relation
      // the General edit page loads — no new query shape introduced.
      include: { verifiedGameVersion: true },
    }),
    // Current version first, then newest — the same ordering every other
    // verification surface uses, feeding the read-only status/current-
    // version rows below.
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!item) {
    notFound();
  }

  const tabs = itemEditorTabs(item.slug, query, "metadata");

  // The Metadata tab (Slice 9B.8): read-only administrative information
  // only — no form, no picker, no checkbox, no delete action, no image
  // controls. The shared VerificationPanel renders in its readOnly mode
  // (status badge and stamp rows, no composed picker/checkbox) and
  // TimestampsPanel supplies created/updated/verified dates; neither
  // component ever surfaces the record's database id or other internal
  // details. The Item's own slug is already visible via the header
  // subtitle, exactly as on every other Item tab.
  return (
    <ItemWorkspace
      rawQuery={q}
      selectedSlug={item.slug}
      recordHref={itemMetadataHref}
      header={
        <>
          <EditorHeader
            title={item.name}
            subtitle={item.slug}
            backHref={withItemSearchQuery(ITEM_LIST_PATH, query)}
            backLabel="Back to Item Management"
          />

          <EditorTabs label="Item editor sections" tabs={tabs} />
        </>
      }
    >
      <VerificationPanel
        gameVersions={gameVersions}
        verifiedAt={item.verifiedAt}
        verifiedGameVersion={item.verifiedGameVersion}
        readOnly
      />

      <TimestampsPanel
        createdAt={item.createdAt}
        updatedAt={item.updatedAt}
        verifiedAt={item.verifiedAt}
      />
    </ItemWorkspace>
  );
}
