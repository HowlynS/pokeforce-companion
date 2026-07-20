import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import {
  PROFESSION_LIST_PATH,
  normalizeProfessionSearchQuery,
  professionEditorTabs,
  professionMetadataHref,
  withProfessionSearchQuery,
} from "@/lib/admin/profession-workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type ProfessionMetadataPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function ProfessionMetadataPage({
  params,
  searchParams,
}: ProfessionMetadataPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeProfessionSearchQuery(q);

  const [profession, gameVersions] = await Promise.all([
    prisma.profession.findUnique({
      where: { slug },
      // One restrained query: the same verifiedGameVersion relation the
      // General edit page already loads, plus a Recipe _count (never the
      // full `recipes` relation, which has nothing to do with this tab —
      // the Recipes tab already covers that relationship in full).
      include: {
        verifiedGameVersion: true,
        _count: { select: { recipes: true } },
      },
    }),
    // Current version first, then newest — the same ordering every other
    // verification surface uses, feeding the read-only status/current-
    // version rows below.
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!profession) {
    notFound();
  }

  const tabs = professionEditorTabs(profession.slug, query, "metadata");

  // The Metadata tab (Slice 9D.4, completing the Profession workspace):
  // read-only administrative information only — no form, no picker, no
  // checkbox, no delete action, no image or Recipe-relationship controls.
  // The shared VerificationPanel renders in its readOnly mode (status
  // badge and stamp rows, no composed picker/checkbox) and
  // TimestampsPanel supplies created/updated/verified dates; neither
  // component ever surfaces the record's database id or other internal
  // details. The Profession's own slug is already visible via the header
  // subtitle, exactly as on every other Profession tab. The description
  // field is deliberately NOT repeated here — it is an editable General
  // field, and this tab exists to show administrative facts General
  // doesn't, not to duplicate it. The Profession context panel below adds
  // the one relational fact useful here — the Recipe count, via `_count`
  // (never the full `recipes` relation) — which always renders, since
  // zero is itself meaningful administrative context.
  return (
    <ProfessionWorkspace
      rawQuery={q}
      selectedSlug={profession.slug}
      recordHref={professionMetadataHref}
      header={
        <>
          <EditorHeader
            title={profession.name}
            subtitle={profession.slug}
            backHref={withProfessionSearchQuery(PROFESSION_LIST_PATH, query)}
            backLabel="Back to Profession Management"
          />

          <EditorTabs label="Profession editor sections" tabs={tabs} />
        </>
      }
    >
      <ContextPanel title="Profession">
        <dl className="admin-panel-dl">
          <div className="admin-panel-row">
            <dt>Recipes</dt>
            <dd>{profession._count.recipes}</dd>
          </div>
        </dl>
      </ContextPanel>

      <VerificationPanel
        gameVersions={gameVersions}
        verifiedAt={profession.verifiedAt}
        verifiedGameVersion={profession.verifiedGameVersion}
        readOnly
      />

      <TimestampsPanel
        createdAt={profession.createdAt}
        updatedAt={profession.updatedAt}
        verifiedAt={profession.verifiedAt}
      />
    </ProfessionWorkspace>
  );
}
