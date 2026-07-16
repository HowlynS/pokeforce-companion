import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
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
  searchParams: Promise<{ error?: string }>;
};

export default async function EditCategoryPage({
  params,
  searchParams,
}: EditCategoryPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const category = await prisma.category.findUnique({ where: { slug } });

  if (!category) {
    notFound();
  }

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Edit Category"
        description={`Update details for "${category.name}".`}
      />

      <p className="admin-toolbar">
        <a href="/admin/categories" className="link-accent">
          &larr; Back to Category Management
        </a>
      </p>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

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

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>

          <a href="/admin/categories" className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </AppShell>
  );
}
