import { notFound } from "next/navigation";
import { ItemNameField } from "@/components/admin/item-name-field";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import {
  itemDeleteHref,
  itemEditorTabs,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";
import { prisma } from "@/lib/db";
import { getImagePublicUrl } from "@/lib/storage/images";
import { updateItemAction } from "../../actions";

export const dynamic = "force-dynamic";

// Associates the image and verification controls — both rendered in the
// aside column, outside this <form> element — with this form via the
// standard HTML `form` attribute, so every field still submits together
// with one ordinary form submission.
const ITEM_EDIT_FORM_ID = "item-edit-form";

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
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

type EditItemPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditItemPage({
  params,
  searchParams,
}: EditItemPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeItemSearchQuery(q);

  const [item, categories] = await Promise.all([
    prisma.item.findUnique({
      where: { slug },
      // Admin-only visibility of the verification stamp: the related Game
      // Version's name is shown next to the opt-in checkbox below.
      include: { verifiedGameVersion: true },
    }),
    prisma.category.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!item) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(item.image);

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  // General is the only implemented section; Acquisition Sources is a
  // real tab since Slice 9B.6 (its own workspace-integrated destination).
  // Used in Recipes and Metadata still describe content that doesn't
  // exist yet and render as inert placeholders rather than links to
  // empty pages.
  const tabs = itemEditorTabs(item.slug, query, "general");

  // The edit route inside the Item workspace (Slice 9B.4), now composed
  // from the shared editor primitives (Slice 9B.5): the record list marks
  // this item selected and keeps the active search applied for quick
  // switching; every field, redirect, and server action is unchanged —
  // only the presentation moved into EditorHeader/Tabs/Panels/Actions.
  // The header's former "Manage acquisition sources" action is gone
  // (Slice 9B.6) — the Acquisition Sources tab replaces it.
  return (
    <ItemWorkspace
      rawQuery={q}
      selectedSlug={item.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Item"
            title={item.name}
            subtitle={item.slug}
          />

          <EditorTabs label="Item editor sections" tabs={tabs} />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={
        <>
          <ImagePanel
            imageUrl={imageUrl}
            imageAlt={`Current image for ${item.name}`}
            formId={ITEM_EDIT_FORM_ID}
          />

          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={item.verifiedAt}
            verifiedGameVersion={item.verifiedGameVersion}
            formId={ITEM_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={item.createdAt}
            updatedAt={item.updatedAt}
          />

          <DangerZonePanel
            resourceLabel="item"
            deleteHref={itemDeleteHref(item.slug, query)}
            deleteLabel="Delete item"
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={ITEM_EDIT_FORM_ID}
        action={updateItemAction}
        className="form-grid form-grid-responsive"
      >
        <input type="hidden" name="id" value={item.id} />
        <input type="hidden" name="originalSlug" value={item.slug} />

        <p className="form-section-heading">Identity</p>

        {/* Client-enhanced Name field with live duplicate feedback. The
            saved name counts as "current" (never queried), and the record's
            own id is excluded server-side so it cannot conflict with
            itself; updateItemAction stays the authoritative check. */}
        <ItemNameField originalName={item.name} excludeId={item.id} />

        <div className="form-field">
          <label className="form-field">
            <span className="form-field-label">Page address</span>
            <input
              type="text"
              name="slug"
              defaultValue={item.slug}
              className="form-input"
            />
          </label>
          <p className="form-field-feedback" aria-hidden="true"></p>
        </div>

        <p className="form-section-heading">Description</p>

        <label className="form-field">
          <span className="form-field-label">Description (optional)</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={item.description ?? ""}
            className="form-input"
          />
        </label>

        <p className="form-section-heading">Classification</p>

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

        <p className="form-section-heading">Gameplay details</p>

        <div className="form-checkbox-group">
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
        </div>

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

        <EditorActions
          submitLabel="Save Changes"
          cancelHref={withItemSearchQuery("/admin/items", query)}
        />
      </form>
      </div>
    </ItemWorkspace>
  );
}
