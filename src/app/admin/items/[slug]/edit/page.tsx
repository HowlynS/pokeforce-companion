import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { ItemNameField } from "@/components/admin/item-name-field";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
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
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
  missing_build_id:
    "The current game build is not configured on the server, so gameplay data cannot be marked as verified.",
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

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(item.image);

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Edit Item"
        description={`Update details for "${item.name}".`}
      />

      <nav className="admin-toolbar" aria-label="Item edit">
        <a href="/admin/items" className="link-accent">
          &larr; Back to Item Management
        </a>

        <a href={`/admin/items/${item.slug}/sources`} className="link-accent">
          Manage acquisition sources
        </a>
      </nav>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      <form action={updateItemAction} className="form-grid">
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="originalSlug" value={item.slug} />

        {/* Client-enhanced Name field with live duplicate feedback. The
            saved name counts as "current" (never queried), and the record's
            own id is excluded server-side so it cannot conflict with
            itself; updateItemAction stays the authoritative check. */}
        <ItemNameField originalName={item.name} excludeId={item.id} />

        <label className="form-field">
          <span className="form-field-label">Slug</span>
          <input
            type="text"
            name="slug"
            defaultValue={item.slug}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">Description (optional)</span>
          <textarea
            name="description"
            rows={3}
            defaultValue={item.description ?? ""}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">Category</span>
          <select
            name="categoryId"
            defaultValue={item.categoryId ?? ""}
            className="form-input"
          >
            <option value="">No category</option>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>

        <label className="form-checkbox-field">
          <input
            type="checkbox"
            name="heldItem"
            defaultChecked={item.heldItem}
          />
          <span>Held item</span>
        </label>

        <label className="form-checkbox-field">
          <input
            type="checkbox"
            name="tradeable"
            defaultChecked={item.tradeable}
          />
          <span>Tradeable</span>
        </label>

        <label className="form-field">
          <span className="form-field-label">Base value (optional)</span>
          <input
            type="number"
            name="baseValue"
            min={0}
            step={1}
            defaultValue={item.baseValue ?? ""}
            className="form-input"
          />
        </label>

        <div className="form-field">
          <span className="form-field-label">Current image</span>
          {imageUrl ? (
            <div style={{ position: "relative", justifySelf: "start" }}>
              <style>{`
                .remove-image-checkbox,
                .remove-image-hidden-text {
                  position: absolute;
                  width: 1px;
                  height: 1px;
                  margin: -1px;
                  padding: 0;
                  overflow: hidden;
                  clip: rect(0 0 0 0);
                  white-space: nowrap;
                  border: 0;
                }
                .remove-image-frame {
                  position: relative;
                  display: inline-block;
                }
                .remove-image-toggle {
                  position: absolute;
                  top: 4px;
                  right: 4px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  width: 22px;
                  height: 22px;
                  border-radius: 9999px;
                  background: ${designTokens.colors.danger};
                  color: ${designTokens.colors.background};
                  font-size: 14px;
                  font-weight: 700;
                  line-height: 1;
                  cursor: pointer;
                  user-select: none;
                }
                .remove-image-checkbox:focus-visible ~ .remove-image-frame .remove-image-toggle {
                  outline: 2px solid ${designTokens.colors.accent};
                  outline-offset: 2px;
                }
                .remove-image-checkbox:checked ~ .remove-image-frame img {
                  opacity: 0.35;
                }
                .remove-image-note {
                  display: none;
                  margin: 6px 0 0;
                  color: ${designTokens.colors.danger};
                }
                .remove-image-checkbox:checked ~ .remove-image-note {
                  display: block;
                }
              `}</style>
              <input
                type="checkbox"
                name="removeImage"
                id="removeImage"
                className="remove-image-checkbox"
              />
              <div className="remove-image-frame">
                {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview; remote next/image configuration is deferred to the public-display slice */}
                <img
                  src={imageUrl}
                  alt={`Current image for ${item.name}`}
                  style={{
                    maxWidth: "128px",
                    height: "auto",
                    border: `1px solid ${designTokens.colors.border}`,
                    borderRadius: designTokens.radius.sm,
                    background: designTokens.colors.surface,
                    padding: "8px",
                    display: "block",
                  }}
                />
                <label
                  htmlFor="removeImage"
                  title="Remove current image"
                  className="remove-image-toggle"
                >
                  <span aria-hidden="true">&times;</span>
                  <span className="remove-image-hidden-text">
                    Remove current image
                  </span>
                </label>
              </div>
              <p className="remove-image-note">
                Image will be removed when saved.
              </p>
            </div>
          ) : (
            <span className="form-field-label">No image uploaded.</span>
          )}
        </div>

        <label className="form-field">
          <span className="form-field-label">
            {item.image
              ? "Replacement image (optional — PNG, JPEG, or WebP, up to 5 MB)"
              : "Image (optional — PNG, JPEG, or WebP, up to 5 MB)"}
          </span>
          <input
            type="file"
            name="image"
            accept="image/png,image/jpeg,image/webp"
            className="form-input"
          />
        </label>

        {/* Explicit per-save action, deliberately never pre-checked (even
            when the record is already verified): the stamped timestamp and
            build id come from the server, and an unchecked box leaves
            existing verification metadata untouched. */}
        <label className="form-checkbox-field">
          <input type="checkbox" name="markVerified" />
          <span>Mark gameplay data as verified for the current build.</span>
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>

          <a href="/admin/items" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </AppShell>
  );
}
