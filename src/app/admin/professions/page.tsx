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

  const inputStyle = {
    border: `1px solid ${designTokens.colors.border}`,
    borderRadius: designTokens.radius.sm,
    background: designTokens.colors.surface,
    color: designTokens.colors.text,
    padding: "10px 12px",
    fontSize: "16px",
    fontFamily: "inherit",
  };

  return (
    <AppShell>
      <PageHeader
        title="Profession Management"
        description="View existing professions and create new ones."
      />

      <p style={{ margin: "0 0 24px" }}>
        <a href="/admin" style={{ color: designTokens.colors.accent }}>
          &larr; Back to Admin
        </a>
      </p>

      {errorMessage ? (
        <p
          role="alert"
          style={{
            border: `1px solid ${designTokens.colors.danger}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.danger,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {errorMessage}
        </p>
      ) : null}

      {successMessage ? (
        <p
          role="status"
          style={{
            border: `1px solid ${designTokens.colors.success}`,
            borderRadius: designTokens.radius.sm,
            background: designTokens.colors.surfaceSoft,
            color: designTokens.colors.success,
            padding: "12px 16px",
            marginBottom: "24px",
          }}
        >
          {successMessage}
        </p>
      ) : null}

      <section style={{ marginBottom: designTokens.layout.sectionGap }}>
        <h2 style={{ fontSize: "24px", lineHeight: 1.2, margin: "0 0 16px" }}>
          Existing Professions
        </h2>

        {professions.length > 0 ? (
          <div
            style={{
              border: `1px solid ${designTokens.colors.border}`,
              borderRadius: designTokens.radius.md,
              background: designTokens.colors.surface,
              overflow: "hidden",
            }}
          >
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Name", "Slug", "Description", "Actions"].map((heading) => (
                    <th
                      key={heading}
                      style={{
                        textAlign: "left",
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                        fontSize: "14px",
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                      }}
                    >
                      {heading}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {professions.map((profession) => (
                  <tr key={profession.id}>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      {profession.name}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {profession.slug}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                        color: designTokens.colors.textMuted,
                      }}
                    >
                      {profession.description ?? "—"}
                    </td>
                    <td
                      style={{
                        padding: "12px 16px",
                        borderBottom: `1px solid ${designTokens.colors.border}`,
                      }}
                    >
                      <a
                        href={`/admin/professions/${profession.slug}/edit`}
                        style={{ color: designTokens.colors.accent, marginRight: "16px" }}
                      >
                        Edit
                      </a>
                      <a
                        href={`/admin/professions/${profession.slug}/delete`}
                        style={{ color: designTokens.colors.danger }}
                      >
                        Delete
                      </a>
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

      <section>
        <h2 style={{ fontSize: "24px", lineHeight: 1.2, margin: "0 0 16px" }}>
          Create Profession
        </h2>

        <form
          action={createProfessionAction}
          style={{
            display: "grid",
            gap: "16px",
            maxWidth: "480px",
          }}
        >
          {/* Client-enhanced Name field with live duplicate feedback; the
              submission-time duplicate check in createProfessionAction
              remains the authoritative protection. */}
          <RecordNameField
            checkAvailabilityAction={checkProfessionNameAvailability}
            takenText="A profession with that name already exists."
            regionId="profession-name-availability"
            inputStyle={inputStyle}
          />

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Slug (optional — generated from name if left blank)
            </span>
            <input type="text" name="slug" style={inputStyle} />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Description (optional)
            </span>
            <textarea
              name="description"
              rows={3}
              style={{ ...inputStyle, resize: "vertical" }}
            />
          </label>

          <label style={{ display: "grid", gap: "6px" }}>
            <span style={{ color: designTokens.colors.textMuted }}>
              Image (optional — PNG, JPEG, or WebP, up to 5 MB)
            </span>
            <input
              type="file"
              name="image"
              accept="image/png,image/jpeg,image/webp"
              style={inputStyle}
            />
          </label>

          <button
            type="submit"
            style={{
              border: "none",
              borderRadius: designTokens.radius.sm,
              background: designTokens.colors.accent,
              color: designTokens.colors.background,
              padding: "12px 16px",
              fontSize: "16px",
              fontWeight: 700,
              cursor: "pointer",
              justifySelf: "start",
            }}
          >
            Create Profession
          </button>
        </form>
      </section>
    </AppShell>
  );
}
