import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
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

const errorMessages: Record<string, string> = {
  missing_name: "Category name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A category with that name or slug already exists.",
  duplicate_name: "A category with that name already exists.",
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

  // The dedicated creation page, following the Item/Recipe/Profession
  // workspaces' navigation-foundation precedent: the form previously
  // embedded at the bottom of /admin/categories, moved here with
  // unchanged action, fields, and validation. No row is selected in the
  // list while creating. Field grouping, EditorHeader/tabs/sticky
  // EditorActions are deliberately NOT adopted in this pass — only the
  // navigation/wrapper moved.
  return (
    <CategoryWorkspace
      rawQuery={q}
      header={
        <>
          <PageHeader
            eyebrow="Admin"
            title="Create Category"
            description="Add a new category to the wiki."
          />

          <p className="admin-toolbar">
            <a
              href={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
              className="link-accent"
            >
              &larr; Back to Category Management
            </a>
          </p>

          {errorMessage ? (
            <p role="alert" className="banner banner-error">
              {errorMessage}
            </p>
          ) : null}
        </>
      }
    >
      <form action={createCategoryAction} className="form-grid">
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
          <textarea name="description" rows={3} className="form-input" />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Create Category
          </button>

          <a
            href={withCategorySearchQuery(CATEGORY_LIST_PATH, query)}
            className="btn btn-secondary"
          >
            Cancel
          </a>
        </div>
      </form>
    </CategoryWorkspace>
  );
}
