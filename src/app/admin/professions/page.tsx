import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { prisma } from "@/lib/db";
import { RecordNameField } from "@/components/admin/record-name-field";
import { createProfessionAction } from "./actions";
import { checkProfessionNameAvailability } from "./name-availability";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_name: "Profession name is required.",
  invalid_slug:
    "Enter a valid slug using lowercase letters, numbers, and hyphens.",
  duplicate: "A profession with that name or slug already exists.",
  duplicate_name: "A profession with that name already exists.",
  missing_profession: "That profession no longer exists.",
  linked_recipes:
    "That profession cannot be deleted while recipes are still assigned to it.",
  image_too_large: "The image must be 5 MB or smaller.",
  invalid_image_type: "Only PNG, JPEG, and WebP images are allowed.",
  upload_failed: "The image could not be uploaded. Please try again.",
  conflicting_image_input:
    "Choose either a replacement image or Remove current image, not both.",
};

const successMessages: Record<string, string> = {
  created: "Profession created.",
  updated: "Profession updated.",
  updated_image_cleanup:
    "Profession updated, but the previous image file could not be removed from storage and may need manual cleanup in Supabase.",
  deleted: "Profession deleted.",
  deleted_image_cleanup:
    "Profession deleted, but its image file could not be removed from storage and may need manual cleanup in Supabase.",
};

type AdminProfessionsPageProps = {
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminProfessionsPage({
  searchParams,
}: AdminProfessionsPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  const professions = await prisma.profession.findMany({
    orderBy: { name: "asc" },
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Profession Management"
        description="View existing professions and create new ones."
      />

      <nav className="admin-toolbar" aria-label="Profession management">
        <a href="/admin" className="link-accent">
          &larr; Back to Admin
        </a>

        <a href="#create-profession" className="btn btn-secondary btn-compact">
          + New profession
        </a>
      </nav>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p role="status" className="banner banner-success">
          {successMessage}
        </p>
      ) : null}

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <h2 className="section-title">Existing Professions</h2>

        {professions.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {["Name", "Slug", "Description", "Actions"].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {professions.map((profession) => (
                  <tr key={profession.id}>
                    <td>{profession.name}</td>
                    <td>{profession.slug}</td>
                    <td>{profession.description ?? "—"}</td>
                    <td>
                      <span className="row-actions">
                        <a
                          href={`/admin/professions/${profession.slug}/edit`}
                          className="link-accent"
                        >
                          Edit
                        </a>
                        <a
                          href={`/admin/professions/${profession.slug}/delete`}
                          className="link-danger"
                        >
                          Delete
                        </a>
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState
            title="No professions yet"
            description="Create the first profession using the form below."
          />
        )}
      </section>

      <section id="create-profession">
        <h2 className="section-title">Create Profession</h2>

        <form action={createProfessionAction} className="form-grid">
          {/* Client-enhanced Name field with live duplicate feedback; the
              submission-time duplicate check in createProfessionAction
              remains the authoritative protection. */}
          <RecordNameField
            checkAvailabilityAction={checkProfessionNameAvailability}
            takenText="A profession with that name already exists."
            regionId="profession-name-availability"
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

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Create Profession
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
