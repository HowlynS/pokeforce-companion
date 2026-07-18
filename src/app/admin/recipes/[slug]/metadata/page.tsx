import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import {
  RECIPE_LIST_PATH,
  normalizeRecipeSearchQuery,
  recipeEditorTabs,
  recipeMetadataHref,
  withRecipeSearchQuery,
} from "@/lib/admin/recipe-workspace";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

type RecipeMetadataPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string }>;
};

export default async function RecipeMetadataPage({
  params,
  searchParams,
}: RecipeMetadataPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q } = await searchParams;
  const query = normalizeRecipeSearchQuery(q);

  const [recipe, gameVersions] = await Promise.all([
    prisma.recipe.findUnique({
      where: { slug },
      // One restrained query: the same verifiedGameVersion relation the
      // General edit page already loads, plus resultingItem/profession
      // (both needed for the read-only Recipe context row below) and an
      // ingredient _count — never the full ingredient rows, which have
      // nothing to do with this tab.
      include: {
        resultingItem: true,
        profession: true,
        verifiedGameVersion: true,
        _count: { select: { ingredients: true } },
      },
    }),
    // Current version first, then newest — the same ordering every other
    // verification surface uses, feeding the read-only status/current-
    // version rows below.
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  if (!recipe) {
    notFound();
  }

  const tabs = recipeEditorTabs(recipe.slug, query, "metadata");

  // The Metadata tab (Slice 9C.4, completing the Recipe workspace): read-
  // only administrative information only — no form, no picker, no
  // checkbox, no delete action, no image or ingredient controls. The
  // shared VerificationPanel renders in its readOnly mode (status badge
  // and stamp rows, no composed picker/checkbox) and TimestampsPanel
  // supplies created/updated/verified dates; neither component ever
  // surfaces the record's database id or other internal details. The
  // Recipe's own slug is already visible via the header subtitle, exactly
  // as on every other Recipe tab. The Recipe context panel below adds
  // read-only relational facts (resulting item, optional profession,
  // optional required level, ingredient count) useful for an admin
  // browsing metadata without needing to open General or Ingredients —
  // each optional field is omitted entirely when absent, never a
  // placeholder dash.
  return (
    <RecipeWorkspace
      rawQuery={q}
      selectedSlug={recipe.slug}
      recordHref={recipeMetadataHref}
      header={
        <>
          <EditorHeader
            title={recipe.name}
            subtitle={recipe.slug}
            backHref={withRecipeSearchQuery(RECIPE_LIST_PATH, query)}
            backLabel="Back to Recipe Management"
          />

          <EditorTabs label="Recipe editor sections" tabs={tabs} />
        </>
      }
    >
      <ContextPanel title="Recipe">
        <dl style={{ margin: 0, display: "grid", gap: "6px" }}>
          <div className="admin-panel-row">
            <dt>Resulting item</dt>
            <dd>
              {recipe.resultingQuantity}x {recipe.resultingItem.name}
            </dd>
          </div>

          {recipe.profession ? (
            <div className="admin-panel-row">
              <dt>Profession</dt>
              <dd>{recipe.profession.name}</dd>
            </div>
          ) : null}

          {recipe.requiredLevel != null ? (
            <div className="admin-panel-row">
              <dt>Required level</dt>
              <dd>{recipe.requiredLevel}</dd>
            </div>
          ) : null}

          <div className="admin-panel-row">
            <dt>Ingredients</dt>
            <dd>{recipe._count.ingredients}</dd>
          </div>
        </dl>
      </ContextPanel>

      <VerificationPanel
        gameVersions={gameVersions}
        verifiedAt={recipe.verifiedAt}
        verifiedGameVersion={recipe.verifiedGameVersion}
        readOnly
      />

      <TimestampsPanel
        createdAt={recipe.createdAt}
        updatedAt={recipe.updatedAt}
        verifiedAt={recipe.verifiedAt}
      />
    </RecipeWorkspace>
  );
}
