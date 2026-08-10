import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentImage } from "@/components/content/content-image";
import { ProfessionRecipeDirectory } from "@/components/content/profession-recipe-directory";
import { RecipeOutputCard } from "@/components/content/recipe-output-card";
import { RichTextContent } from "@/components/content/rich-text-content";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { formatPublicVerification } from "@/lib/public-verification";
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

  const verification = formatPublicVerification(profession);
  const updatedAt = formatDisplayDate(profession.updatedAt);
  const grid = (
    <div className="profession-recipe-grid">
      {profession.recipes.map((recipe, index) => (
        <div
          className="cx-item-in"
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
          key={recipe.id}
        >
          <RecipeOutputCard recipe={recipe} variant="profession-grid" />
        </div>
      ))}
    </div>
  );
  const list = (
    <div className="profession-recipe-list">
      <div className="profession-recipe-list-header" aria-hidden="true">
        <span />
        <span>Recipe</span>
        <span>Profession</span>
        <span>EXP</span>
        <span>Ingredients</span>
      </div>
      {profession.recipes.map((recipe, index) => (
        <div
          className="cx-item-in"
          style={{ animationDelay: `${Math.min(index * 30, 330)}ms` }}
          key={recipe.id}
        >
          <RecipeOutputCard recipe={recipe} variant="profession-list" />
        </div>
      ))}
    </div>
  );

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

        <section className="profession-detail-hero" aria-labelledby="profession-title">
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
              <span className="profession-detail-chip">
                Recipes:&nbsp;<strong>{profession.recipes.length}</strong>
              </span>
            </div>
          </div>
        </section>

        {profession.recipes.length > 0 ? (
          <ProfessionRecipeDirectory grid={grid} list={list} />
        ) : null}

        <section
          className="profession-verification"
          aria-labelledby="profession-verification-title"
        >
          <div className="profession-verification-heading">
            <h2 id="profession-verification-title">Verification</h2>
            <p className="item-verification-state">
              {verification ? "Verified" : "Unverified"}
            </p>
          </div>
          <div>
            <p className="item-verification-copy">
              {verification ??
                "This Profession’s gameplay information has not been verified for a Game Version."}
            </p>
            {updatedAt ? (
              <p className="profession-updated">Updated {updatedAt}</p>
            ) : null}
          </div>
        </section>
      </article>
    </AppShell>
  );
}
