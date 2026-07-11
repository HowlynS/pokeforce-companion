import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { createCategoryAction } from "./actions";

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

  const inputStyle = {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: designTokens.radius.sm,
    background: designTokens.colors.surface,
    color: designTokens.colors.text,
    padding: "10px 12px",
    fontSize: "16px",
    fontFamily: "inherit",
  };

  return (
    <AppShell>
      <PageHeader
        title="Category Management"
        description="View existing categories and create new ones."
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Admin
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

      {successMessage ? (
        <p
          role="status"
          style={{
            border: `1px solid ${designTokens.colors.success}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.success,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {successMessage}
        </p>
      ) : null}

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <h2 style={{ fontSize: "24px", lineHeight: 1.2, margin: "0 0 16px" }}>
          Existing Categories
        </h2>

        {categories.length > 0 ? (
          <div
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.md,
              background: designTokens.colors.surface,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Slug", "Description", "Actions"].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                        fontSize: "14px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {categories.map((category) => (
                  <tr key={category.id}>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      {category.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {category.slug}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {category.description ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      <a
                        href={`/admin/categories/${category.slug}/edit`}
                        style={{ color: designTokens.colors.accent, marginRight: "16px" }}
                      >
                        Edit
                      </a>
                      <a
                        href={`/admin/categories/${category.slug}/delete`}
                        style={{ color: designTokens.colors.danger }}
                      >
                        Delete
                      </a>
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

      <section>
        <h2 style={{ fontSize: "24px", lineHeight: 1.2, margin: "0 0 16px" }}>
          Create Category
        </h2>

        <form
          action={createCategoryAction}
          style={{
            display: "grid",
            gap: "16px",
            maxWidth: "480px",
          }}
        >
          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>Name</span>
            <input type="text" name="name" required style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Slug (optional — generated from name if left blank)
            </span>
            <input type="text" name="slug" style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Description (optional)
            </span>
            <textarea
              name="description"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <button
            type="submit"
            style={{
              border: "none",
              borderRadius: designTokens.radius.sm,
              background: designTokens.colors.accent,
              color: designTokens.colors.background,
              padding: "12px 16px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              justifySelf: "start",
            }}
          >
            Create Category
          </button>
        </form>
      </section>
    </AppShell>
  );
}
