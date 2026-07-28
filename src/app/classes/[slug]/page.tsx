import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentImage } from "@/components/content/content-image";
import { AppShell } from "@/components/layout/app-shell";
import { cataloguePageHref } from "@/lib/catalogue-query";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { formatPublicVerification } from "@/lib/public-verification";
import { formatRecipeQuantityRange } from "@/lib/recipes/recipe-quantity";

export const dynamic = "force-dynamic";

type PlayerClassDetailPageProps = {
  params: Promise<{ slug: string }>;
};

// Reuses the Profession detail page's own "compact discipline hero, capped
// preview, factual Verification" visual pattern (the `.profession-*` CSS
// classes below are pure, content-free layout/visual rules — no Profession
// wording is baked into them) rather than duplicating a parallel `.class-*`
// stylesheet for an identical visual shape, mirroring this file's own
// existing reuse of the generic `item-*` classes (breadcrumb, category
// label, verification state/copy, resource title).
export default async function PlayerClassDetailPage({
  params,
}: PlayerClassDetailPageProps) {
  const { slug } = await params;
  const playerClass = await prisma.playerClass.findUnique({
    where: { slug },
    select: {
      name: true,
      description: true,
      image: true,
      updatedAt: true,
      verifiedAt: true,
      verifiedGameVersion: { select: { name: true } },
      recipes: {
        select: {
          id: true,
          slug: true,
          name: true,
          resultQuantityMin: true,
          resultQuantityMax: true,
          resultingItem: {
            select: {
              name: true,
              slug: true,
              image: true,
              category: { select: { name: true } },
            },
          },
        },
        orderBy: [{ name: "asc" }, { id: "asc" }],
      },
    },
  });

  if (!playerClass) {
    notFound();
  }

  const verification = formatPublicVerification(playerClass);
  const updatedAt = formatDisplayDate(playerClass.updatedAt);
  const previewRecipes = playerClass.recipes.slice(0, 3);

  return (
    <AppShell wide>
      <article className="item-detail-page profession-detail-page">
        <nav
          aria-label="Breadcrumb"
          className="public-breadcrumb item-breadcrumb"
        >
          <ol>
            <li>
              <Link href="/" className="breadcrumb-link">
                Home
              </Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <Link href="/classes" className="breadcrumb-link">
                Classes
              </Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{playerClass.name}</span>
            </li>
          </ol>
        </nav>

        <div
          className={`profession-codex-frame${
            playerClass.recipes.length <= 1
              ? " profession-codex-frame--sparse"
              : ""
          }`}
        >
          <section
            className="profession-discipline-hero"
            aria-labelledby="player-class-title"
          >
            <div className="profession-identity-stage">
              <ContentImage
                imagePath={playerClass.image}
                alt={`Image of ${playerClass.name}`}
                size="hero"
              />
            </div>

            <div className="profession-identity-copy">
              <p className="item-category-label">Class</p>
              <h1 id="player-class-title" className="public-resource-title">
                {playerClass.name}
              </h1>
              {playerClass.description ? (
                <p className="profession-description">
                  {playerClass.description}
                </p>
              ) : null}
              {updatedAt ? (
                <p className="profession-updated">Updated {updatedAt}</p>
              ) : null}
            </div>

            <dl className="profession-hero-counts" aria-label="Class totals">
              <div>
                <dt>Recipes</dt>
                <dd>{playerClass.recipes.length}</dd>
              </div>
            </dl>
          </section>

          {previewRecipes.length > 0 ? (
            <section
              className="profession-recipe-preview"
              aria-labelledby="player-class-recipes-title"
            >
              <header className="profession-recipe-preview-header">
                <div>
                  <p>Player class</p>
                  <h2 id="player-class-recipes-title">Recipes</h2>
                </div>
                <Link
                  href={cataloguePageHref("/recipes", 1, { class: slug })}
                >
                  Browse all {playerClass.name} recipes
                </Link>
              </header>
              <div className="profession-recipe-preview-list">
                {previewRecipes.map((recipe) => {
                  const quantity = formatRecipeQuantityRange(
                    recipe.resultQuantityMin,
                    recipe.resultQuantityMax
                  );
                  const recipeLinkLabel = `${recipe.name}, produces ×${quantity} ${
                    recipe.resultingItem.name
                  }${
                    recipe.resultingItem.category
                      ? `, category ${recipe.resultingItem.category.name}`
                      : ""
                  }`;

                  return (
                    <Link
                      className="profession-recipe-preview-row"
                      href={`/recipes/${recipe.slug}`}
                      aria-label={recipeLinkLabel}
                      key={recipe.id}
                    >
                      <ContentImage
                        imagePath={recipe.resultingItem.image}
                        alt={`Image of ${recipe.resultingItem.name}`}
                        size="row"
                      />
                      <span>
                        <strong>{recipe.name}</strong>
                        <span>
                          Produces ×{quantity} {recipe.resultingItem.name}
                        </span>
                        {recipe.resultingItem.category ? (
                          <span>{recipe.resultingItem.category.name}</span>
                        ) : null}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </section>
          ) : null}

          <section
            className="profession-verification"
            aria-labelledby="player-class-verification-title"
          >
            <div className="profession-verification-heading">
              <h2 id="player-class-verification-title">Verification</h2>
              <p className="item-verification-state">
                {verification ? "Verified" : "Unverified"}
              </p>
            </div>
            <p className="item-verification-copy">
              {verification ??
                "This Class’s gameplay information has not been verified for a Game Version."}
            </p>
          </section>
        </div>
      </article>
    </AppShell>
  );
}
