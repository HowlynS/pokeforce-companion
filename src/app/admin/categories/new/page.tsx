import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { ImagePanel } from "@/components/admin/image-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import {
  CATEGORY_LIST_PATH,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";
import { RecordNameField } from "@/components/admin/record-name-field";
import { createCategoryAction } from "../actions";
import { checkCategoryNameAvailability } from "../name-availability";

export const dynamic = "force-dynamic";

// Associates the file input — rendered in the aside column, outside this
// <form> element — with this form via the standard HTML `form` attribute,
// so every field still submits together with one ordinary form submission.
const CATEGORY_CREATE_FORM_ID = "category-create-form";

const errorMessages: Record<string, string> = {
  missing_name: "Category name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A category with that name or slug already exists.",
  duplicate_name: "A category with that name already exists.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
};

type NewCategoryPageProps = {
  searchParams: Promise<{ q?: string; error?: string }>;
};

export default async function NewCategoryPage({
  searchParams,
}: NewCategoryPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { q, error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const query = normalizeCategorySearchQuery(q);

  // Only General makes sense before a record exists — Items and
  // Metadata both describe an existing Category's relations and history,
  // so they are omitted here rather than shown as disabled placeholders
  // (matching the Item/Recipe/Profession General editors' create-page
  // precedent exactly).
  const tabs: EditorTab[] = [
    {
      label: "General",
      href: withCategorySearchQuery("/admin/categories/new", query),
      active: true,
    },
  ];

  // The dedicated creation page, now composed from the shared editor
  // primitives (Slice 9E.2): the form previously plain, moved here
  // unchanged in field/action/validation terms — only the presentation
  // now uses EditorHeader/EditorTabs/EditorActions. Categories carry no
  // gameplay-verification behavior, so no VerificationPanel exists here —
  // unlike Item/Recipe/Profession. ImagePanel was added for Category
  // Images; Items and Metadata tabs, and TimestampsPanel, still do not
  // apply to a record that doesn't exist yet.
  return (
    <CategoryWorkspace
      rawQuery={q}
      header={
        <>
          <EditorHeader
            title="Create Category"
            subtitle="Add a new category to the wiki."
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
        <ImagePanel>
          <label className="form-field">
            <span className="form-field-label">
              Image (optional — PNG, JPEG, or WebP, up to 5 MB)
            </span>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              form={CATEGORY_CREATE_FORM_ID}
              className="form-input"
            />
          </label>
        </ImagePanel>
      }
    >
      <div className="admin-editor-surface">
      <form
        id={CATEGORY_CREATE_FORM_ID}
        action={createCategoryAction}
        className="form-grid"
      >
        {/* Client-enhanced Name field with live duplicate feedback; the
            submission-time duplicate check in createCategoryAction
            remains the authoritative protection. */}
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
          <textarea name="description" rows={4} className="form-input" />
        </label>

        <EditorActions
          submitLabel="Create Category"
          cancelHref={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
        />
      </form>
      </div>
    </CategoryWorkspace>
  );
}
