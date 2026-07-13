import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { createItemAction } from "./actions";

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
  linked_recipes:
    "That item cannot be deleted while recipes still reference it.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

const successMessages: Record<string, string> = {
  created: "Item created.",
  updated: "Item updated.",
  updated_image_cleanup:
    "Item updated, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  deleted: "Item deleted.",
  deleted_image_cleanup:
    "Item deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
};

type AdminItemsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminItemsPage({
  searchParams,
}: AdminItemsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  const [items, categories] = await Promise.all([
    prisma.item.findMany({
      include: { category: true },
      orderBy: { name: "asc" },
    }),
    prisma.category.findMany({
      orderBy: { name: "asc" },
    }),
  ]);

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
        title="Item Management"
        description="View existing items and create new ones."
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
          Existing Items
        </h2>

        {items.length > 0 ? (
          <div
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.md,
              background: designTokens.colors.surface,
              overflow: "hidden",
              overflowX: "auto",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {[
                    "Name",
                    "Slug",
                    "Category",
                    "Rarity",
                    "Tradeable",
                    "Base Value",
                    "Actions",
                  ].map((heading) => (
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
                        whiteSpace: "nowrap",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      {item.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {item.slug}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {item.category?.name ?? "Uncategorized"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {item.rarity ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {item.tradeable ? "Yes" : "No"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {item.baseValue ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      <a
                        href={`/admin/items/${item.slug}/edit`}
                        style={{ color: designTokens.colors.accent, marginRight: "16px" }}
                      >
                        Edit
                      </a>
                      <a
                        href={`/admin/items/${item.slug}/delete`}
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
            title="No items yet"
            description="Create the first item using the form below."
          />
        )}
      </section>

      <section>
        <h2 style={{ fontSize: "24px", lineHeight: 1.2, margin: "0 0 16px" }}>
          Create Item
        </h2>

        <form
          action={createItemAction}
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

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Category
            </span>
            <select name="categoryId" defaultValue="" style={inputStyle}>
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
            <input type="text" name="rarity" style={inputStyle} />
          </label>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              color: designTokens.colors.textMuted,
            }}
          >
            <input type="checkbox" name="tradeable" />
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
              style={inputStyle}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Image (optional — PNG, JPEG, or WebP, up to 5 MB)
            </span>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              style={inputStyle}
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
            Create Item
          </button>
        </form>
      </section>
    </AppShell>
  );
}
