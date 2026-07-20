import { notFound } from "next/navigation";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
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
import { updateCategoryAction } from "../../actions";
import { checkCategoryNameAvailability } from "../../name-availability";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Category name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A category with that name or slug already exists.",
  duplicate_name: "A category with that name already exists.",
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

  const tabs = categoryEditorTabs(category.slug, query);

  // The General edit route inside the Category workspace, now composed
  // from the shared editor primitives (Slice 9E.2): the record list
  // marks this category selected and keeps the active search applied for
  // quick switching. Every field, redirect, and server action is
  // unchanged — only the presentation moved. Categories have no image or
  // gameplay-verification behavior, so no ImagePanel or VerificationPanel
  // exists here — unlike Item/Recipe/Profession. Items (a relationship
  // tab) and Metadata remain disabled placeholders; Delete lives in
  // `EditorActions`' own `deleteHref` since Categories carry no capacity
  // guard that would ever need to hide the form.
  return (
    <CategoryWorkspace
      rawQuery={q}
      selectedSlug={category.slug}
      header={
        <>
          <EditorHeader
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
        <TimestampsPanel
          createdAt={category.createdAt}
          updatedAt={category.updatedAt}
        />
      }
    >
      <form action={updateCategoryAction} className="form-grid">
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
            rows={3}
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
    </CategoryWorkspace>
  );
}
