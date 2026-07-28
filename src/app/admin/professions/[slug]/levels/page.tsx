import { notFound } from "next/navigation";
import { EditorHeader } from "@/components/admin/editor-header";
import { InfoTooltip } from "@/components/admin/info-tooltip";
import { EditorSection } from "@/components/admin/editor-section";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ProfessionWorkspace } from "@/components/admin/profession-workspace";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import {
  normalizeProfessionSearchQuery,
  professionEditorTabs,
  professionLevelsHref,
} from "@/lib/admin/profession-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { withProfessionLevelDifferences } from "@/lib/professions/profession-levels";

export const dynamic = "force-dynamic";

const numberFormatter = new Intl.NumberFormat("en-US");

type ProfessionLevelsPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function ProfessionLevelsPage({
  params,
  searchParams,
}: ProfessionLevelsPageProps) {
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeProfessionSearchQuery(q);
  const [profession, thresholds] = await Promise.all([
    prisma.profession.findUnique({
      where: { slug },
      include: { _count: { select: { recipes: true } } },
    }),
    prisma.professionLevel.findMany({ orderBy: { level: "asc" } }),
  ]);

  if (!profession) {
    notFound();
  }

  const progression = withProfessionLevelDifferences(thresholds);
  const tabs = professionEditorTabs(profession.slug, query, "levels", {
    recipes: profession._count.recipes,
  });

  return (
    <ProfessionWorkspace
      rawQuery={q}
      selectedSlug={profession.slug}
      recordHref={professionLevelsHref}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Profession"
            title={profession.name}
            subtitle={profession.slug}
          />
          <EditorTabs label="Profession editor sections" tabs={tabs} />
        </>
      }
    >
      <EditorSection
        title="Levels"
        icon={SECTION_ICONS.progression}
        description="This progression curve is shared by all Professions."
      >
        <div
          className="admin-table-wrap profession-level-table-wrap"
          tabIndex={0}
          role="region"
          aria-label="Profession level progression"
        >
          <table className="admin-table profession-level-table">
            <thead>
              <tr>
                <th>Level</th>
                <th>EXP to next level</th>
                <th>
                  <span className="profession-level-heading-with-help">
                    <span>Cumulative EXP</span>
                    <span className="profession-level-info">
                      <InfoTooltip
                        label="About cumulative EXP"
                        content="Total EXP required to reach this level from level 1."
                      />
                    </span>
                  </span>
                </th>
              </tr>
            </thead>
            <tbody>
              {progression.map((row) => (
                <tr key={row.level}>
                  <td>{row.level}</td>
                  <td>
                    {row.experienceToNext === null
                      ? "—"
                      : numberFormatter.format(row.experienceToNext)}
                  </td>
                  <td>{numberFormatter.format(row.experienceRequired)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </EditorSection>
    </ProfessionWorkspace>
  );
}
