import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { RecordNameField } from "@/components/admin/record-name-field";
import { createCategoryAction } from "./actions";
import { checkCategoryNameAvailability } from "./name-availability";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Category name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A category with that name or slug already exists.",
  duplicate_name: "A category with that name already exists.",
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
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminCategoriesPage({
  searchParams,
}: AdminCategoriesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  const categories = await prisma.category.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Category Management"
        description="View existing categories and create new ones."
      />

      <nav className="admin-toolbar" aria-label="Category management">
        <a href="/admin" className="link-accent">
          &larr; Back to Admin
        </a>

        <a href="#create-category" className="btn btn-secondary btn-compact">
          + New category
        </a>
      </nav>

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

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <h2 className="section-title">Existing Categories</h2>

        {categories.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Name", "Slug", "Description", "Actions"].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td>{category.name}</td>
                    <td>{category.slug}</td>
                    <td>{category.description ?? "—"}</td>
                    <td>
                      <span className="row-actions">
                        <a
                          href={`/admin/categories/${category.slug}/edit`}
                          className="link-accent"
                        >
                          Edit
                        </a>
                        <a
                          href={`/admin/categories/${category.slug}/delete`}
                          className="link-danger"
                        >
                          Delete
                        </a>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No categories yet"
            description="Create the first category using the form below."
          />
        )}
      </section>

      <section id="create-category">
        <h2 className="section-title">Create Category</h2>

        <form action={createCategoryAction} className="form-grid">
          {/* Client-enhanced Name field with live duplicate feedback; the
              submission-time duplicate check in createCategoryAction remains
              the authoritative protection. */}
          <RecordNameField
            checkAvailabilityAction={checkCategoryNameAvailability}
            takenText="A category with that name already exists."
            regionId="category-name-availability"
          />

          <label className="form-field">
            <span className="form-field-label">
              Slug (optional — generated from name if left blank)
            </span>
            <input type="text" name="slug" className="form-input" />
          </label>

          <label className="form-field">
            <span className="form-field-label">Description (optional)</span>
            <textarea name="description" rows={3} className="form-input" />
          </label>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Create Category
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
