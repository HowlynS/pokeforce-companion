import { PageHeader } from "@/components/layout/page-header";
import { ItemNameField } from "@/components/admin/item-name-field";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import {
  ITEM_LIST_PATH,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { createItemAction } from "../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Item name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  invalid_base_value: "Base value must be a whole number of zero or more.",
  duplicate: "An item with that name or slug already exists.",
  duplicate_name: "An item with that name already exists.",
  invalid_category: "Select an existing category, or choose No category.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

type NewItemPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewItemPage({ searchParams }: NewItemPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeItemSearchQuery(q);

  const [categories, gameVersions] = await Promise.all([
    prisma.category.findMany({ orderBy: { name: "asc" } }),
    // Current version first, then newest — the same ordering the
    // settings list uses; feeds the shared verification picker.
    prisma.gameVersion.findMany({
      orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
    }),
  ]);

  // The dedicated creation page (Slice 9B.4): the form previously embedded
  // at the bottom of /admin/items, moved here unchanged — same action,
  // validation, image handling, and verification controls. No row is
  // selected in the list while creating.
  return (
    <ItemWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Create Item"
            description="Add a new item to the wiki."
          />

          <nav className="admin-toolbar" aria-label="Item creation">
            <a
              href={withItemSearchQuery(ITEM_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Item Management
            </a>
          </nav>

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
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

          <a
            href={withItemSearchQuery(ITEM_LIST_PATH, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </form>
    </ItemWorkspace>
  );
}
