import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { updateItemAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Item name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  invalid_base_value: "Base value must be a whole number of zero or more.",
  duplicate: "An item with that name or slug already exists.",
  duplicate_name: "An item with that name already exists.",
  invalid_category: "Select an existing category, or choose No category.",
  missing_item: "That item no longer exists.",
};

type EditItemPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditItemPage({
  params,
  searchParams,
}: EditItemPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const [item, categories] = await Promise.all([
    prisma.item.findUnique({ where: { slug } }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!item) {
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
        title="Edit Item"
        description={`Update details for "${item.name}".`}
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin/items" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Item Management
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
        action={updateItemAction}
        style={{
          display: "grid",
          gap: "16px",
          maxWidth: "480px",
        }}
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="originalSlug" value={item.slug} />

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>Name</span>
          <input
            type="text"
            name="name"
            required
            defaultValue={item.name}
            style={inputStyle}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>Slug</span>
          <input
            type="text"
            name="slug"
            defaultValue={item.slug}
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
            defaultValue={item.description ?? ""}
            style={{ ...inputStyle, resize: "vertical" }}
          />
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>
            Category
          </span>
          <select
            name="categoryId"
            defaultValue={item.categoryId ?? ""}
            style={inputStyle}
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>
            Rarity (optional)
          </span>
          <input
            type="text"
            name="rarity"
            defaultValue={item.rarity ?? ""}
            style={inputStyle}
          />
        </label>

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            color: designTokens.colors.textMuted,
          }}
        >
          <input
            type="checkbox"
            name="tradeable"
            defaultChecked={item.tradeable}
          />
          <span>Tradeable</span>
        </label>

        <label style={{ display: "grid", gap: "6px" }}>
          <span style={{ color: designTokens.colors.textMuted }}>
            Base value (optional)
          </span>
          <input
            type="number"
            name="baseValue"
            min={0}
            step={1}
            defaultValue={item.baseValue ?? ""}
            style={inputStyle}
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
            href="/admin/items"
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
