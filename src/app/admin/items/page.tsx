import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { ItemNameField } from "@/components/admin/item-name-field";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
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
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
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

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Item Management"
        description="View existing items and create new ones."
      />

      <nav className="admin-toolbar" aria-label="Item management">
        <a href="/admin" className="link-accent">
          &larr; Back to Admin
        </a>

        <a href="#create-item" className="btn btn-secondary btn-compact">
          + New item
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
        <h2 className="section-title">Existing Items</h2>

        {items.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {[
                    "Name",
                    "Slug",
                    "Category",
                    "Held Item",
                    "Tradeable",
                    "Base Value",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td>{item.name}</td>
                    <td>{item.slug}</td>
                    <td>{item.category?.name ?? "Uncategorized"}</td>
                    <td>{item.heldItem ? "Yes" : "No"}</td>
                    <td>{item.tradeable ? "Yes" : "No"}</td>
                    <td>{item.baseValue ?? "—"}</td>
                    <td>
                      <span className="row-actions">
                        <a
                          href={`/admin/items/${item.slug}/edit`}
                          className="link-accent"
                        >
                          Edit
                        </a>
                        <a
                          href={`/admin/items/${item.slug}/sources`}
                          className="link-accent"
                        >
                          Sources
                        </a>
                        <a
                          href={`/admin/items/${item.slug}/delete`}
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
            title="No items yet"
            description="Create the first item using the form below."
          />
        )}
      </section>

      <section id="create-item">
        <h2 className="section-title">Create Item</h2>

        <form action={createItemAction} className="form-grid">
          {/* Client-enhanced Name field with live duplicate feedback; the
              submission-time duplicate check in createItemAction remains
              the authoritative protection. */}
          <ItemNameField />

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

          <label className="form-field">
            <span className="form-field-label">Category</span>
            <select name="categoryId" defaultValue="" className="form-input">
              <option value="">No category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-checkbox-field">
            <input type="checkbox" name="heldItem" />
            <span>Held item</span>
          </label>

          <label className="form-checkbox-field">
            <input type="checkbox" name="tradeable" />
            <span>Tradeable</span>
          </label>

          <label className="form-field">
            <span className="form-field-label">Base value (optional)</span>
            <input
              type="number"
              name="baseValue"
              min={0}
              step={1}
              className="form-input"
            />
          </label>

          <label className="form-field">
            <span className="form-field-label">
              Image (optional — PNG, JPEG, or WebP, up to 5 MB)
            </span>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              className="form-input"
            />
          </label>

          <GameVersionVerificationControls gameVersions={gameVersions} />

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Create Item
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
