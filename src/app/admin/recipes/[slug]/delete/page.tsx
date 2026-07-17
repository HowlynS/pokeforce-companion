import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { deleteRecipeAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_recipe: "That recipe no longer exists.",
};

type DeleteRecipePageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function DeleteRecipePage({
  params,
  searchParams,
}: DeleteRecipePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const recipe = await prisma.recipe.findUnique({
    where: { slug },
    include: {
      resultingItem: true,
      profession: true,
      ingredients: {
        include: { item: true },
        orderBy: { item: { name: "asc" } },
      },
    },
  });

  if (!recipe) {
    notFound();
  }

  const ingredientSummary =
    recipe.ingredients.length > 0
      ? recipe.ingredients
          .map((ingredient) => `${ingredient.quantity}x ${ingredient.item.name}`)
          .join(", ")
      : "None";

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Delete Recipe"
        description={`Review before permanently deleting "${recipe.name}".`}
      />

      <p className="admin-toolbar">
        <a href="/admin/recipes" className="link-accent">
          &larr; Back to Recipe Management
        </a>
      </p>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      <div className="confirm-card">
        <p>
          You are about to permanently delete <strong>{recipe.name}</strong> (
          {recipe.slug}). This action cannot be undone.
        </p>

        <p className="text-muted">
          Result: {recipe.resultingQuantity}x {recipe.resultingItem.name}
        </p>

        <p className="text-muted">
          Profession: {recipe.profession?.name ?? "No profession"}
        </p>

        <p className="text-muted">
          Ingredients ({recipe.ingredients.length}): {ingredientSummary}
        </p>

        <p className="text-muted">
          The resulting item, ingredient items, and profession will not be
          deleted — only this recipe and its own ingredient list entries.
        </p>

        <div className="form-actions">
          <form action={deleteRecipeAction}>
            <input type="hidden" name="id" value={recipe.id} />
            <input type="hidden" name="slug" value={recipe.slug} />
            <button type="submit" className="btn btn-danger">
              Delete Permanently
            </button>
          </form>

          <a href="/admin/recipes" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </div>
    </>
  );
}
