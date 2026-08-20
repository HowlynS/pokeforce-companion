import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentImage } from "@/components/content/content-image";
import { RecipeCollectionSection } from "@/components/content/recipe-collection-section";
import {
  RecipeCollectionGrid,
  RecipeCollectionList,
} from "@/components/content/recipe-collection-views";
import { RichTextContent } from "@/components/content/rich-text-content";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { VerificationStatus } from "@/components/ui/verification-status";
import { cataloguePageHref } from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { recipeOutputCardSelect } from "@/lib/recipes/recipe-output-catalogue";

export const dynamic = "force-dynamic";

type ProfessionDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProfessionDetailPage({
  params,
}: ProfessionDetailPageProps) {
  const { slug } = await params;
  const [profession, levelSummary] = await Promise.all([
    prisma.profession.findUnique({
      where: { slug },
      select: {
        name: true,
        description: true,
        descriptionRich: true,
        image: true,
        updatedAt: true,
        verifiedAt: true,
        verifiedGameVersion: { select: { name: true } },
        recipes: {
          select: recipeOutputCardSelect,
          orderBy: [{ name: "asc" }, { id: "asc" }],
        },
      },
    }),
    prisma.professionLevel.aggregate({ _max: { level: true } }),
  ]);

  if (!profession) notFound();

  const updatedAt = formatDisplayDate(profession.updatedAt);
  const grid = <RecipeCollectionGrid recipes={profession.recipes} />;
  const list = <RecipeCollectionList recipes={profession.recipes} />;

  return (
    <AppShell scenic="detail" wide>
      <article className="profession-detail-page">
        <Breadcrumb
          segments={[
            { name: "Home", href: "/" },
            { name: "Professions", href: "/professions" },
          ]}
          current={profession.name}
        />

        <section
          className="profession-detail-hero resource-atmosphere resource-atmosphere--profession"
          aria-labelledby="profession-title"
        >
          <VerificationStatus
            stamp={profession}
            className="detail-hero-verification"
          />
          <div className="profession-detail-stage">
            <ContentImage
              imagePath={profession.image}
              alt={`Image of ${profession.name}`}
              size="hero"
            />
          </div>

          <div className="profession-detail-copy">
            <p className="profession-detail-eyebrow">Profession</p>
            <h1 id="profession-title" className="public-resource-title">
              {profession.name}
            </h1>
            <RichTextContent
              value={profession.descriptionRich}
              fallback={profession.description}
              className="profession-description rich-text-content"
            />
            <div className="profession-detail-chips" aria-label="Profession facts">
              <Link href="/professions" className="profession-detail-chip">
                Resource:&nbsp;<strong>Profession</strong>
              </Link>
              {levelSummary._max.level ? (
                <span className="profession-detail-chip">
                  Max Level:&nbsp;<strong>{levelSummary._max.level}</strong>
                </span>
              ) : null}
              {profession.recipes.length > 0 ? (
                // Deep link into the Recipe directory's existing canonical
                // Profession filter (`/recipes?profession=<slug>`), not a
                // bespoke route: the directory hydrates the filter from the
                // URL, so the popover shows this Profession checked and the
                // link stays shareable and reload-safe.
                <Link
                  href={cataloguePageHref("/recipes", 1, {
                    profession: [slug],
                  })}
                  className="profession-detail-chip"
                  aria-label={`View ${profession.recipes.length} ${profession.name} recipes`}
                >
                  Recipes:&nbsp;<strong>{profession.recipes.length}</strong>
                </Link>
              ) : (
                <span className="profession-detail-chip">
                  Recipes:&nbsp;<strong>{profession.recipes.length}</strong>
                </span>
              )}
            </div>
          </div>
        </section>

        {profession.recipes.length > 0 ? (
          <RecipeCollectionSection title="Recipes" grid={grid} list={list} />
        ) : null}

        {updatedAt ? (
          <p className="profession-updated">Updated {updatedAt}</p>
        ) : null}
      </article>
    </AppShell>
  );
}
