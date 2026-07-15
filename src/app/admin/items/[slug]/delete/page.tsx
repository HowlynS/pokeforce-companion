import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { deleteItemAction } from "../../actions";

export const dynamic = "force-dynamic";

type DeleteItemPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

function describeRecipeReferences(
  resultCount: number,
  ingredientCount: number
): string {
  const parts: string[] = [];

  if (resultCount > 0) {
    parts.push(
      `the result of ${resultCount} ${resultCount === 1 ? "recipe" : "recipes"}`
    );
  }

  if (ingredientCount > 0) {
    parts.push(
      `an ingredient in ${ingredientCount} ${
        ingredientCount === 1 ? "recipe" : "recipes"
      }`
    );
  }

  return parts.join(" and ");
}

export default async function DeleteItemPage({
  params,
  searchParams,
}: DeleteItemPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;

  const item = await prisma.item.findUnique({
    where: { slug },
    include: {
      category: true,
      _count: { select: { recipesProduced: true, recipeIngredients: true } },
    },
  });

  if (!item) {
    notFound();
  }

  const resultCount = item._count.recipesProduced;
  const ingredientCount = item._count.recipeIngredients;
  const canDelete = resultCount === 0 && ingredientCount === 0;

  return (
    <AppShell>
      <PageHeader
        title="Delete Item"
        description={`Review before permanently deleting "${item.name}".`}
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin/items" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Item Management
        </a>
      </p>

      {error ? (
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
          {error === "linked_recipes"
            ? `This item cannot be deleted because it is used as ${describeRecipeReferences(
                resultCount,
                ingredientCount
              )}.`
            : "Something went wrong."}
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
          maxWidth: "480px",
        }}
      >
        <p style={{ margin: 0 }}>
          You are about to permanently delete <strong>{item.name}</strong> (
          {item.slug}). This action cannot be undone.
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Category: {item.category?.name ?? "Uncategorized"}
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Used as a recipe result: {resultCount}
        </p>

        <p style={{ margin: 0, color: designTokens.colors.textMuted }}>
          Used as a recipe ingredient: {ingredientCount}
        </p>

        {!canDelete ? (
          <p style={{ margin: 0, color: designTokens.colors.danger }}>
            This item cannot be deleted because it is used as{" "}
            {describeRecipeReferences(resultCount, ingredientCount)}. Remove
            or reassign those recipe references first.
          </p>
        ) : null}

        <div style={{ display: "flex", gap: "12px" }}>
          {canDelete ? (
            <form action={deleteItemAction}>
              <input type="hidden" name="id" value={item.id} />
              <input type="hidden" name="slug" value={item.slug} />
              <button type="submit" className="btn btn-danger">
                Delete Permanently
              </button>
            </form>
          ) : null}

          <a href="/admin/items" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </div>
    </AppShell>
  );
}
