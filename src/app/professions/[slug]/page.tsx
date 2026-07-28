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

type ProfessionDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function ProfessionDetailPage({
  params,
}: ProfessionDetailPageProps) {
  const { slug } = await params;
  const profession = await prisma.profession.findUnique({
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
          requiredLevel: true,
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

  if (!profession) {
    notFound();
  }

  const verification = formatPublicVerification(profession);
  const updatedAt = formatDisplayDate(profession.updatedAt);
  const resultingItemCount = new Set(
    profession.recipes.map((recipe) => recipe.resultingItem.slug)
  ).size;
  const previewRecipes = profession.recipes.slice(0, 3);

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
              <Link href="/professions" className="breadcrumb-link">
                Professions
              </Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{profession.name}</span>
            </li>
          </ol>
        </nav>

        <div
          className={`profession-codex-frame${
            profession.recipes.length <= 1
              ? " profession-codex-frame--sparse"
              : ""
          }`}
        >
          <section
            className="profession-discipline-hero"
            aria-labelledby="profession-title"
          >
            <div className="profession-identity-stage">
              <ContentImage
                imagePath={profession.image}
                alt={`Image of ${profession.name}`}
                size="hero"
              />
            </div>

            <div className="profession-identity-copy">
              <p className="item-category-label">Profession</p>
              <h1 id="profession-title" className="public-resource-title">
                {profession.name}
              </h1>
              {profession.description ? (
                <p className="profession-description">
                  {profession.description}
                </p>
              ) : null}
              {updatedAt ? (
                <p className="profession-updated">Updated {updatedAt}</p>
              ) : null}
            </div>

            <dl className="profession-hero-counts" aria-label="Profession totals">
              <div>
                <dt>Recipes</dt>
                <dd>{profession.recipes.length}</dd>
              </div>
              <div>
                <dt>Resulting items</dt>
                <dd>{resultingItemCount}</dd>
              </div>
            </dl>
          </section>

          {previewRecipes.length > 0 ? (
            <section
              className="profession-recipe-preview"
              aria-labelledby="profession-recipes-title"
            >
              <header className="profession-recipe-preview-header">
                <div>
                  <p>Crafting discipline</p>
                  <h2 id="profession-recipes-title">Recipes</h2>
                </div>
                <Link
                  href={cataloguePageHref("/recipes", 1, {
                    profession: slug,
                  })}
                >
                  Browse all {profession.name} recipes
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
                        {recipe.requiredLevel !== null ? (
                          <span>Requires level {recipe.requiredLevel}</span>
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
            aria-labelledby="profession-verification-title"
          >
            <div className="profession-verification-heading">
              <h2 id="profession-verification-title">Verification</h2>
              <p className="item-verification-state">
                {verification ? "Verified" : "Unverified"}
              </p>
            </div>
            <p className="item-verification-copy">
              {verification ??
                "This Profession’s gameplay information has not been verified for a Game Version."}
            </p>
          </section>
        </div>
      </article>
    </AppShell>
  );
}
