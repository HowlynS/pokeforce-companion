import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
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
    <AppShell>
      <PageHeader
        title="Delete Recipe"
        description={`Review before permanently deleting "${recipe.name}".`}
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin/recipes" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Recipe Management
        </a>
      </p>

      {errorMessage ? (
        <p
          role="alert"
          style={{
            border: `1px solid ${designTokens.colors.danger}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.danger,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      <div
        style={{
          border: `1px solid ${designTokens.colors.danger}`,
          borderRadius: designTokens.radius.md,
          background: designTokens.colors.surfaceSoft,
          padding: "24px",
          display: "grid",
          gap: "16px",
          maxWidth: "560px",
        }}
      >
        <p style={{ margin: 0 }}>
          You are about to permanently delete <strong>{recipe.name}</strong> (
          {recipe.slug}). This action cannot be undone.
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Result: {recipe.resultingQuantity}x {recipe.resultingItem.name}
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Profession: {recipe.profession?.name ?? "No profession"}
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Ingredients ({recipe.ingredients.length}): {ingredientSummary}
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          The resulting item, ingredient items, and profession will not be
          deleted — only this recipe and its own ingredient list entries.
        </p>

        <div style={{ display: "flex", gap: "12px" }}>
          <form action={deleteRecipeAction}>
            <input type="hidden" name="id" value={recipe.id} />
            <input type="hidden" name="slug" value={recipe.slug} />
            <button
              type="submit"
              style={{
                border: "none",
                borderRadius: designTokens.radius.sm,
                background: designTokens.colors.danger,
                color: designTokens.colors.text,
                padding: "12px 16px",
                fontSize: "16px",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              Delete Permanently
            </button>
          </form>

          <a
            href="/admin/recipes"
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.sm,
              background: designTokens.colors.surface,
              color: designTokens.colors.text,
              padding: "12px 16px",
              fontSize: "16px",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            Cancel
          </a>
        </div>
      </div>
    </AppShell>
  );
}
