import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { EditorSection } from "@/components/admin/editor-section";
import { ImagePanel } from "@/components/admin/image-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { AdminFormGuard } from "@/components/admin/admin-form-guard";
import { DangerZonePanel } from "@/components/admin/danger-zone-panel";
import { AutosizeTextarea } from "@/components/admin/autosize-textarea";
import { CategoryWorkspace } from "@/components/admin/category-workspace";
import {
  CATEGORY_LIST_PATH,
  categoryCanDelete,
  categoryEditorTabs,
  describeLinkedItems,
  normalizeCategorySearchQuery,
  withCategorySearchQuery,
} from "@/lib/admin/category-workspace";
import { RecordIdentityFields } from "@/components/admin/record-identity-fields";
import { getImagePublicUrl } from "@/lib/storage/images";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { updateCategoryAction, deleteCategoryAction } from "../../actions";
import { checkCategoryNameAvailability } from "../../name-availability";
import { checkCategorySlugAvailability } from "../../slug-availability";

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

  const category = await prisma.category.findUnique({
    where: { slug },
    // Count only — feeds the Items tab's own badge; General never needs
    // the actual Item rows themselves.
    include: { _count: { select: { items: true } } },
  });

  if (!category) {
    notFound();
  }

  // Derived from the trusted database path; null when no image is stored.
  const imageUrl = await getImagePublicUrl(category.image);

  const tabs = categoryEditorTabs(category.slug, query, "general", {
    items: category._count.items,
  });

  // Feeds the in-editor delete dialog (Admin Polish Pass 1, Part 5) — the
  // exact same count and rule the dedicated /delete route uses, reusing
  // the tab-badge query above rather than a second query.
  const itemCount = category._count.items;
  const canDeleteCategory = categoryCanDelete(itemCount);

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
      // Admin Polish Pass 2, Part 5: forces a full remount of the record
      // list, form, and aside whenever this category's own updatedAt
      // actually changes — see the Item General editor's own identical
      // comment (src/app/admin/items/[slug]/edit/page.tsx) for the full
      // reasoning.
      key={category.updatedAt.toISOString()}
      rawQuery={q}
      selectedSlug={category.slug}
      editorHeader={
        <>
          <EditorHeader
            eyebrow="Category"
            title={category.name}
            subtitle={category.slug}
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
          <ImagePanel
            imageUrl={imageUrl}
            imageAlt={`Current image for ${category.name}`}
            formId={CATEGORY_EDIT_FORM_ID}
          />

          <TimestampsPanel
            createdAt={category.createdAt}
            updatedAt={category.updatedAt}
          />

          <DangerZonePanel
            resourceLabel="category"
            deleteLabel="Delete Category"
            dialogTitle="Delete Category"
            dialogDescription={
              <>
                You are about to permanently delete{" "}
                <strong>{category.name}</strong> ({category.slug}). This
                action cannot be undone.
              </>
            }
            canDelete={canDeleteCategory}
            formAction={deleteCategoryAction}
            hiddenFields={{ id: category.id, slug: category.slug }}
          >
            <p className="text-muted">Linked items: {itemCount}</p>

            {!canDeleteCategory ? (
              <p className="text-danger">
                This category cannot be deleted because it is assigned to{" "}
                {describeLinkedItems(itemCount)}. Reassign or remove those
                items first.
              </p>
            ) : null}
          </DangerZonePanel>
        </>
      }
    >

      <div className="admin-editor-surface">
      <form
        id={CATEGORY_EDIT_FORM_ID}
        action={updateCategoryAction}
        className="form-grid form-grid-responsive"
      >
        <input type="hidden" name="id" value={category.id} />
        <input type="hidden" name="originalSlug" value={category.slug} />

        <div className="admin-editor-sections">
          <EditorSection title="Identity" icon={SECTION_ICONS.identity}>
            {/* Client-enhanced Name + Page address fields (Phase B1).
                Both saved values count as "current" (never queried
                against themselves), and the record's own id is excluded
                server-side so it cannot conflict with itself;
                updateCategoryAction stays the authoritative check for
                both. Page address starts showing the persisted value
                and tracks Name live until the contributor manually
                edits it themselves (Part 11) — the same one-way
                auto/manual behavior create forms already had. */}
            <RecordIdentityFields
              checkNameAvailabilityAction={checkCategoryNameAvailability}
              nameTakenText="A category with that name already exists."
              nameRegionId="category-name-availability"
              originalName={category.name}
              checkSlugAvailabilityAction={checkCategorySlugAvailability}
              slugTakenText="A category with that page address already exists."
              slugRegionId="category-slug-availability"
              initialSlug={category.slug}
              excludeId={category.id}
            />
          </EditorSection>

          <EditorSection title="Description" icon={SECTION_ICONS.content}>
            <label className="form-field">
              <span className="form-field-label">Description (optional)</span>
              <AutosizeTextarea
                name="description"
                defaultValue={category.description ?? ""}
                className="form-input"
              />
            </label>
          </EditorSection>
        </div>

        {/* Sonnet Rollout Pass: the guarded actions row replaces the plain
            EditorActions — unsaved-changes protection, draft persistence,
            Ctrl/Cmd+S, and save-state feedback, all scoped to this form.
            The record id and its original slug are excluded from dirty
            comparison; Categories carry no verification picker. */}
        <AdminFormGuard
          submitLabel="Save Changes"
          cancelHref={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
          excludeFields={["id", "originalSlug"]}
          draftKey={`category:edit:${category.id}:category-edit-form`}
          serverUpdatedAt={category.updatedAt.toISOString()}
        />
      </form>
      </div>
    </CategoryWorkspace>
  );
}
