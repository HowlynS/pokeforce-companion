import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";

export const dynamic = "force-dynamic";

// Create-form validation errors now surface on /admin/categories/new,
// where the form lives; this landing state only reports outcomes that
// redirect back to the list itself.
const errorMessages: Record<string, string> = {
  missing_category: "That category no longer exists.",
  linked_items:
    "That category cannot be deleted while items are still assigned to it.",
};

const successMessages: Record<string, string> = {
  created: "Category created.",
  updated: "Category updated.",
  deleted: "Category deleted.",
};

type AdminCategoriesPageProps = {
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
};

export default async function AdminCategoriesPage({
  searchParams,
}: AdminCategoriesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  // The workspace landing state: the searchable record list beside a
  // restrained guidance region — the create form lives on
  // /admin/categories/new, following the Item/Recipe/Profession
  // workspaces' navigation-foundation precedent.
  return (
    <CategoryWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Category Management"
            description="Select a category to edit, or create a new one."
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
      <EmptyState
        title="Select a category"
        description="Choose a category from the list to edit its details — or use “+ New category” to create one."
      />
    </CategoryWorkspace>
  );
}
