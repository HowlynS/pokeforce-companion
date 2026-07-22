import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { RecipeWorkspace } from "@/components/admin/recipe-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

// Create-form validation errors now surface on /admin/recipes/new, where
// the form lives; this landing state only reports outcomes that redirect
// back to the list itself.
const errorMessages: Record<string, string> = {
  missing_recipe: "That recipe no longer exists.",
};

const successMessages: Record<string, string> = {
  created: "Recipe created.",
  updated: "Recipe updated.",
  updated_image_cleanup:
    "Recipe updated, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  deleted: "Recipe deleted.",
  deleted_image_cleanup:
    "Recipe deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
};

type AdminRecipesPageProps = {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
};

export default async function AdminRecipesPage({
  searchParams,
}: AdminRecipesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  // Distinguishes "no recipes exist at all" from "recipes exist, none
  // selected" for the landing state's own copy (skipped while a search
  // is active — that is RecordList's own "no matches" state instead).
  const totalRecipeCount = q ? null : await prisma.recipe.count();
  const hasNoRecipes = totalRecipeCount === 0;

  // The workspace landing state: the searchable record list beside a
  // restrained guidance region — the create form lives on
  // /admin/recipes/new (Slice 9C.1, following the Item workspace's
  // precedent from Slice 9B.4).
  return (
    <RecipeWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Recipe Management"
            description="Select a recipe to edit, or create a new one."
          />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}

          {successMessage ? (
            <p role="status" className="banner banner-success">
              {successMessage}
            </p>
          ) : null}
        </>
      }
    >
      {hasNoRecipes ? (
        <EmptyState
          title="No recipes yet"
          description="Create the first recipe to start building out the wiki's crafting data."
          action={
            <a href="/admin/recipes/new" className="btn btn-primary">
              Create Recipe
            </a>
          }
        />
      ) : (
        <EmptyState
          title="Select a recipe"
          description="Choose a recipe from the list to edit its details and ingredients — or create a new one."
          action={
            <a href="/admin/recipes/new" className="btn btn-primary">
              Create Recipe
            </a>
          }
        />
      )}
    </RecipeWorkspace>
  );
}
