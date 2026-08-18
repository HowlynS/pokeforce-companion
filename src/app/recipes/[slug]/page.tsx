import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Breadcrumb } from "@/components/layout/breadcrumb";
import { CollapsibleSection } from "@/components/content/collapsible-section";
import { ContentImage } from "@/components/content/content-image";
import { RecipeCollectionSection } from "@/components/content/recipe-collection-section";
import {
  RecipeCollectionGrid,
  RecipeCollectionList,
} from "@/components/content/recipe-collection-views";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { formatPublicVerification } from "@/lib/public-verification";
import { resolveRecipeDisplayImage } from "@/lib/recipes/recipe-image";
import { recipeOutputCardSelect } from "@/lib/recipes/recipe-output-catalogue";
import { formatRecipeQuantityRange } from "@/lib/recipes/recipe-quantity";

export const dynamic = "force-dynamic";

type RecipeDetailPageProps = {
  params: Promise<{ slug: string }>;
};

export default async function RecipeDetailPage({
  params,
}: RecipeDetailPageProps) {
  const { slug } = await params;
  const recipe = await prisma.recipe.findUnique({
    where: { slug },
    select: {
      name: true,
      image: true,
      resultQuantityMin: true,
      resultQuantityMax: true,
      updatedAt: true,
      verifiedAt: true,
      verifiedGameVersion: { select: { name: true } },
      profession: { select: { name: true, slug: true } },
      requiredLevel: true,
      experienceReward: true,
      resultingItem: {
        select: {
          name: true,
          slug: true,
          image: true,
          category: { select: { name: true } },
        },
      },
      ingredients: {
        select: {
          id: true,
          quantity: true,
          item: {
            select: {
              name: true,
              slug: true,
              image: true,
              category: { select: { name: true } },
            },
          },
        },
        orderBy: { item: { name: "asc" } },
      },
    },
  });

  if (!recipe) {
    notFound();
  }

  // Related Recipes: other Recipes belonging to the same Profession — a
  // real, derivable relationship (Recipe.profession), never an invented
  // Class or gameplay-unlock association.
  const relatedRecipes = recipe.profession
    ? await prisma.recipe.findMany({
        where: {
          profession: { slug: recipe.profession.slug },
          slug: { not: slug },
        },
        // The canonical Recipe relationship card's own shape.
        select: recipeOutputCardSelect,
        orderBy: { name: "asc" },
        take: 12,
      })
    : [];

  const heroImage = resolveRecipeDisplayImage({
    recipeImage: recipe.image,
    resultingItemImage: recipe.resultingItem.image,
  });
  const resultQuantity = formatRecipeQuantityRange(
    recipe.resultQuantityMin,
    recipe.resultQuantityMax
  );
  const verification = formatPublicVerification(recipe);
  const updatedAt = formatDisplayDate(recipe.updatedAt);

  return (
    <AppShell scenic="detail" wide>
      <article className="item-detail-page recipe-detail-page">
        <Breadcrumb
          segments={[
            { name: "Home", href: "/" },
            { name: "Recipes", href: "/recipes" },
          ]}
          current={recipe.name}
        />

        <div className="item-content-grid">
          <div className="item-main-column">
            <section
              className="item-identity-panel resource-atmosphere resource-atmosphere--recipe"
              aria-labelledby="recipe-title"
            >
              <div className="item-identity-stage recipe-identity-stage">
                <ContentImage
                  imagePath={heroImage}
                  alt={`Image of ${recipe.name}`}
                  size="hero"
                />
                <span className="recipe-hero-yield" aria-hidden="true">
                  <span>Yields</span>
                  <strong>{resultQuantity}</strong>
                </span>
              </div>

              <div className="item-identity-copy">
                {recipe.profession ? (
                  <p className="item-category-label">
                    {recipe.profession.name} Recipe
                  </p>
                ) : null}
                <h1 id="recipe-title" className="public-resource-title">
                  {recipe.name}
                </h1>
                <p className="recipe-summary">
                  {recipe.profession && recipe.requiredLevel !== null
                    ? "A Level " +
                      recipe.requiredLevel +
                      " " +
                      recipe.profession.name +
                      " recipe."
                    : recipe.profession
                      ? "A " + recipe.profession.name + " recipe."
                      : "A crafting recipe."}{" "}
                  Yields {resultQuantity} on completion.
                </p>
                <div className="item-info-chips recipe-info-chips">
                  {recipe.profession ? (
                    <Link
                      href={"/professions/" + recipe.profession.slug}
                      className="item-info-chip public-content-link"
                    >
                      Profession: <strong>{recipe.profession.name}</strong>
                    </Link>
                  ) : null}
                  {recipe.requiredLevel !== null ? (
                    <span className="item-info-chip">
                      Level: <strong>{recipe.requiredLevel}</strong>
                    </span>
                  ) : null}
                  <span className="item-info-chip">
                    Reward:{" "}
                    <strong className="item-info-chip-accent">
                      +{recipe.experienceReward} EXP
                    </strong>
                  </span>
                </div>
              </div>
            </section>

            <div className="item-lower-grid recipe-lower-grid">
              {recipe.ingredients.length > 0 ? (
                <CollapsibleSection
                  title="Ingredients"
                  className="item-panel recipe-ingredients-panel"
                >
                  <div className="item-recipe-rows">
                    {recipe.ingredients.map((ingredient) => (
                      <Link
                        className="item-recipe-row recipe-ingredient-row"
                        href={`/items/${ingredient.item.slug}`}
                        key={ingredient.id}
                      >
                        <span className="item-recipe-thumbnail">
                          <ContentImage
                            imagePath={ingredient.item.image}
                            alt={`Image of ${ingredient.item.name}`}
                            size="row"
                          />
                        </span>
                        <span className="item-recipe-copy">
                          <strong>{ingredient.item.name}</strong>
                          {ingredient.item.category ? (
                            <span>{ingredient.item.category.name}</span>
                          ) : null}
                        </span>
                        <strong className="recipe-ingredient-quantity">
                          × {ingredient.quantity}
                        </strong>
                      </Link>
                    ))}
                  </div>
                </CollapsibleSection>
              ) : null}

              <section className="item-panel recipe-result-panel">
                {/* Same section-heading system as Ingredients and Related
                    Recipes, but always expanded: a plain heading, never a
                    disclosure trigger. */}
                <h2 className="detail-collapsible-heading">
                  <span className="detail-static-heading-label">
                    Crafted result
                    <span className="detail-collapsible-rule" aria-hidden="true" />
                  </span>
                </h2>
                <Link
                  className="item-recipe-row recipe-result-row"
                  href={`/items/${recipe.resultingItem.slug}`}
                >
                  <span className="recipe-result-image-stage">
                    <ContentImage
                      imagePath={recipe.resultingItem.image}
                      alt={`Image of ${recipe.resultingItem.name}`}
                      size="card"
                    />
                    <span className="recipe-result-yield" aria-hidden="true">
                      × {resultQuantity}
                    </span>
                  </span>
                  <span className="item-recipe-copy">
                    <strong>{recipe.resultingItem.name}</strong>
                    {recipe.resultingItem.category ? (
                      <span>{recipe.resultingItem.category.name}</span>
                    ) : null}
                    <span>Produces × {resultQuantity}</span>
                  </span>
                </Link>
              </section>
            </div>

            {relatedRecipes.length > 0 ? (
              <RecipeCollectionSection
                title="Related Recipes"
                grid={<RecipeCollectionGrid recipes={relatedRecipes} />}
                list={<RecipeCollectionList recipes={relatedRecipes} />}
              />
            ) : null}

            <section
              className="recipe-verification-strip"
              aria-labelledby="recipe-verification-title"
            >
              <h2 id="recipe-verification-title">Verification</h2>
              <p className="item-verification-state">
                {verification ? "Verified" : "Unverified"}
              </p>
              <p className="item-verification-copy">
                {verification ??
                  "This Recipe’s gameplay information has not been verified for a Game Version."}
              </p>
              {updatedAt ? (
                <p className="recipe-updated-at">Last updated {updatedAt}</p>
              ) : null}
            </section>
          </div>

        </div>
      </article>
    </AppShell>
  );
}
