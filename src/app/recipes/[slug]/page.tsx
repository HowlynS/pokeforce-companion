import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { ContentImage } from "@/components/content/content-image";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { formatPublicVerification } from "@/lib/public-verification";
import { resolveRecipeDisplayImage } from "@/lib/recipes/recipe-image";
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
    <AppShell wide>
      <article className="item-detail-page recipe-detail-page">
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
              <Link href="/recipes" className="breadcrumb-link">
                Recipes
              </Link>
            </li>
            <li>
              <span aria-hidden="true">/</span>
              <span aria-current="page">{recipe.name}</span>
            </li>
          </ol>
        </nav>

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
              </div>

              <div className="item-identity-copy">
                {recipe.profession ? (
                  <p className="item-category-label">
                    {recipe.profession.name}
                  </p>
                ) : null}
                <h1 id="recipe-title" className="public-resource-title">
                  {recipe.name}
                </h1>
                <dl className="item-fact-strip recipe-fact-strip">
                  <div>
                    <dt>Result quantity</dt>
                    <dd>× {resultQuantity}</dd>
                  </div>
                  <div>
                    <dt>Ingredients</dt>
                    <dd>{recipe.ingredients.length}</dd>
                  </div>
                </dl>
              </div>
            </section>

            <div className="item-lower-grid recipe-lower-grid">
              {recipe.ingredients.length > 0 ? (
                <section className="item-panel recipe-ingredients-panel">
                  <h2>Ingredients</h2>
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
                </section>
              ) : null}

              <section className="item-panel recipe-result-panel">
                <h2>Crafted result</h2>
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
          </div>

          <aside className="item-sidebar" aria-label="Recipe information">
            <section className="item-panel item-sidebar-panel">
              <h2>Recipe details</h2>
              <dl className="item-detail-list">
                {recipe.profession ? (
                  <div>
                    <dt>Profession</dt>
                    <dd>
                      <Link
                        href={`/professions/${recipe.profession.slug}`}
                        className="public-content-link"
                      >
                        {recipe.profession.name}
                      </Link>
                    </dd>
                  </div>
                ) : null}
                {recipe.requiredLevel !== null ? (
                  <div>
                    <dt>Required profession level</dt>
                    <dd>{recipe.requiredLevel}</dd>
                  </div>
                ) : null}
                <div>
                  <dt>Result</dt>
                  <dd>
                    <Link
                      href={`/items/${recipe.resultingItem.slug}`}
                      className="public-content-link"
                    >
                      {recipe.resultingItem.name}
                    </Link>
                  </dd>
                </div>
                <div>
                  <dt>Ingredients</dt>
                  <dd>{recipe.ingredients.length}</dd>
                </div>
                <div>
                  <dt>EXP reward</dt>
                  <dd>{recipe.experienceReward} EXP</dd>
                </div>
                {updatedAt ? (
                  <div>
                    <dt>Last updated</dt>
                    <dd>{updatedAt}</dd>
                  </div>
                ) : null}
              </dl>
            </section>

            <section className="item-panel item-sidebar-panel">
              <h2>Verification</h2>
              <p className="item-verification-state">
                {verification ? "Verified" : "Unverified"}
              </p>
              <p className="item-verification-copy">
                {verification ??
                  "This Recipe’s gameplay information has not been verified for a Game Version."}
              </p>
            </section>
          </aside>
        </div>
      </article>
    </AppShell>
  );
}
