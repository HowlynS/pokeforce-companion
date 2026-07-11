import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { updateCategoryAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Category name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A category with that name or slug already exists.",
  duplicate_name: "A category with that name already exists.",
};

type EditCategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditCategoryPage({
  params,
  searchParams,
}: EditCategoryPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const category = await prisma.category.findUnique({ where: { slug } });

  if (!category) {
    notFound();
  }

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
        title="Edit Category"
        description={`Update details for "${category.name}".`}
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin/categories" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Category Management
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

      <form
        action={updateCategoryAction}
        style={{
          display: "grid",
          gap: "16px",
          maxWidth: "480px",
        }}
      >
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="originalSlug" value={category.slug} />

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={category.name}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>Slug</span>
          <input
            type="text"
            name="slug"
            defaultValue={category.slug}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>
            Description (optional)
          </span>
          <textarea
            name="description"
            rows={3}
            defaultValue={category.description ?? ""}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <div style={{ display: "flex", gap: "12px" }}>
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
            }}
          >
            Save Changes
          </button>

          <a
            href="/admin/categories"
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.sm,
              background: designTokens.colors.surfaceSoft,
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
      </form>
    </AppShell>
  );
}
