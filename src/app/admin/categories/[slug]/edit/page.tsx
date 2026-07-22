import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import {
  CATEGORY_LIST_PATH,
  categoryDeleteHref,
  categoryEditorTabs,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";
import { RecordNameField } from "@/components/admin/record-name-field";
import { getImagePublicUrl } from "@/lib/storage/images";
import { updateCategoryAction } from "../../actions";
import { checkCategoryNameAvailability } from "../../name-availability";

export const dynamic = "force-dynamic";

// Associates the image control — rendered in the aside column, outside
// this <form> element — with this form via the standard HTML `form`
// attribute, so every field still submits together with one ordinary
// form submission.
const CATEGORY_EDIT_FORM_ID = "category-edit-form";

const errorMessages: Record<string, string> = {
  missing_name: "Category name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A category with that name or slug already exists.",
  duplicate_name: "A category with that name already exists.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

type EditCategoryPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function EditCategoryPage({
  params,
  searchParams,
}: EditCategoryPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeCategorySearchQuery(q);

  const category = await prisma.category.findUnique({ where: { slug } });

  if (!category) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(category.image);

  const tabs = categoryEditorTabs(category.slug, query, "general");

  // The General edit route inside the Category workspace, now composed
  // from the shared editor primitives (Slice 9E.2): the record list
  // marks this category selected and keeps the active search applied for
  // quick switching. Every field, redirect, and server action is
  // unchanged — only the presentation moved. Categories carry no
  // gameplay-verification behavior, so no VerificationPanel exists here —
  // unlike Item/Recipe/Profession. ImagePanel was added for Category
  // Images. Items (Slice 9E.3) and Metadata (Slice 9E.4) are both real
  // tabs now. Delete lives in `EditorActions`' own `deleteHref` since
  // Categories carry no capacity guard that would ever need to hide the
  // form.
  return (
    <CategoryWorkspace
      rawQuery={q}
      selectedSlug={category.slug}
      header={
        <>
          <EditorHeader
            eyebrow="Category"
            title={category.name}
            subtitle={category.slug}
            backHref={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
            backLabel="Back to Category Management"
          />

          <EditorTabs label="Category editor sections" tabs={tabs} />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={
        <>
          <ImagePanel>
            {imageUrl ? (
              <div className="admin-image-preview-wrap">
                <input
                  type="checkbox"
                  name="removeImage"
                  id="removeImage"
                  form={CATEGORY_EDIT_FORM_ID}
                  className="admin-image-remove-checkbox"
                />
                <div className="admin-image-remove-frame">
                  {/* eslint-disable-next-line @next/next/no-img-element -- admin-only preview; remote next/image configuration is deferred to the public-display slice */}
                  <img
                    src={imageUrl}
                    alt={`Current image for ${category.name}`}
                    className="admin-image-preview"
                  />
                  <label
                    htmlFor="removeImage"
                    title="Remove current image"
                    className="admin-image-remove-toggle"
                  >
                    <span aria-hidden="true">&times;</span>
                    <span className="admin-image-remove-hidden-text">
                      Remove current image
                    </span>
                  </label>
                </div>
                <p className="admin-image-remove-note">
                  Image will be removed when saved.
                </p>
              </div>
            ) : (
              <span className="admin-image-empty">No image uploaded.</span>
            )}

            <label className="form-field">
              <span className="form-field-label">
                {category.image
                  ? "Replacement image (optional — PNG, JPEG, or WebP, up to 5 MB)"
                  : "Image (optional — PNG, JPEG, or WebP, up to 5 MB)"}
              </span>
              <input
                type="file"
                name="image"
                accept="image/png,image/jpeg,image/webp"
                form={CATEGORY_EDIT_FORM_ID}
                className="form-input"
              />
            </label>
          </ImagePanel>

          <TimestampsPanel
            createdAt={category.createdAt}
            updatedAt={category.updatedAt}
          />
        </>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={CATEGORY_EDIT_FORM_ID}
        action={updateCategoryAction}
        className="form-grid"
      >
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="originalSlug" value={category.slug} />

        {/* Client-enhanced Name field with live duplicate feedback. The
            saved name counts as "current" (never queried), and the record's
            own id is excluded server-side so it cannot conflict with
            itself; updateCategoryAction stays the authoritative check. */}
        <RecordNameField
          checkAvailabilityAction={checkCategoryNameAvailability}
          takenText="A category with that name already exists."
          regionId="category-name-availability"
          originalName={category.name}
          excludeId={category.id}
        />

        <label className="form-field">
          <span className="form-field-label">Slug</span>
          <input
            type="text"
            name="slug"
            defaultValue={category.slug}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">Description (optional)</span>
          <textarea
            name="description"
            rows={4}
            defaultValue={category.description ?? ""}
            className="form-input"
          />
        </label>

        <EditorActions
          submitLabel="Save Changes"
          cancelHref={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
          deleteHref={categoryDeleteHref(category.slug, query)}
          deleteLabel="Delete Category"
        />
      </form>
      </div>
    </CategoryWorkspace>
  );
}
