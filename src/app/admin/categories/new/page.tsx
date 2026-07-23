import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs, type EditorTab } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { EditorActions } from "@/components/admin/editor-actions";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import {
  CATEGORY_LIST_PATH,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { createCategoryAction } from "../actions";
import { checkCategoryNameAvailability } from "../name-availability";
import { checkCategorySlugAvailability } from "../slug-availability";

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
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Category"
            title="Create Category"
            subtitle="Add a new category to the wiki."
          />

          <EditorTabs label="Category editor sections" tabs={tabs} />

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
      aside={<ImagePanel imageUrl={null} formId={CATEGORY_CREATE_FORM_ID} />}
    >
      <div className="admin-editor-surface">
      <form
        id={CATEGORY_CREATE_FORM_ID}
        action={createCategoryAction}
        className="form-grid form-grid-responsive"
      >
        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields (Phase B1); the
                submission-time checks in createCategoryAction remain the
                authoritative protection for both. */}
            <RecordIdentityFields
              checkNameAvailabilityAction={checkCategoryNameAvailability}
              nameTakenText="A category with that name already exists."
              nameRegionId="category-name-availability"
              checkSlugAvailabilityAction={checkCategorySlugAvailability}
              slugTakenText="A category with that page address already exists."
              slugRegionId="category-slug-availability"
            />
          </EditorSection>

          <EditorSection title="Description" icon={SECTION_ICONS.content}>
            <label className="form-field">
              <span className="form-field-label">Description (optional)</span>
              <AutosizeTextarea name="description" className="form-input" />
            </label>
          </EditorSection>
        </div>

        <EditorActions
          submitLabel="Create Category"
          cancelHref={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
        />
      </form>
      </div>
    </CategoryWorkspace>
  );
}
