import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { EmptyState } from "@/components/ui/empty-state";
import { designTokens } from "@/lib/design-tokens";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { prisma } from "@/lib/db";
import {
  ACQUISITION_TYPES,
  ACQUISITION_TYPE_LABELS,
} from "@/lib/validation/acquisition-source";
import { createAcquisitionSourceAction } from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_type: "Select an acquisition type.",
  invalid_type: "Select a valid acquisition type.",
  invalid_location: "Select an existing location, or choose No location.",
  invalid_profession: "Select an existing profession, or choose No profession.",
  missing_item: "That item no longer exists.",
  missing_source: "That acquisition source no longer exists.",
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

const successMessages: Record<string, string> = {
  created: "Acquisition source added.",
  updated: "Acquisition source updated.",
  deleted: "Acquisition source removed.",
};

type AdminItemSourcesPageProps = {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

export default async function AdminItemSourcesPage({
  params,
  searchParams,
}: AdminItemSourcesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;

  const [item, locations, professions] = await Promise.all([
    prisma.item.findUnique({
      where: { slug },
      include: {
        acquisitionSources: {
          include: { location: true, profession: true },
          orderBy: { createdAt: "asc" },
        },
      },
    }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!item) {
    notFound();
  }

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  return (
    <AppShell>
      <PageHeader
        eyebrow="Admin"
        title="Acquisition Sources"
        description={`Manage how "${item.name}" can be obtained.`}
      />

      <p className="admin-toolbar">
        <a href={`/admin/items/${item.slug}/edit`} className="link-accent">
          &larr; Back to Edit Item
        </a>
      </p>

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
        <h2 className="section-title">Existing Sources</h2>

        {item.acquisitionSources.length > 0 ? (
          <div className="admin-table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  {[
                    "Type",
                    "Source",
                    "Location",
                    "Profession",
                    "Quantity",
                    "Verified",
                    "Actions",
                  ].map((heading) => (
                    <th key={heading}>{heading}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {item.acquisitionSources.map((source) => (
                  <tr key={source.id}>
                    <td>{ACQUISITION_TYPE_LABELS[source.type]}</td>
                    <td>{source.sourceLabel ?? "—"}</td>
                    <td>{source.location?.name ?? "—"}</td>
                    <td>{source.profession?.name ?? "—"}</td>
                    <td>{source.quantity ?? "—"}</td>
                    <td>{source.verifiedAt ? "Yes" : "No"}</td>
                    <td>
                      <span className="row-actions">
                        <a
                          href={`/admin/items/${item.slug}/sources/${source.id}/edit`}
                          className="link-accent"
                        >
                          Edit
                        </a>
                        <a
                          href={`/admin/items/${item.slug}/sources/${source.id}/delete`}
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
            title="No acquisition sources yet"
            description="Add the first source using the form below."
          />
        )}
      </section>

      <section id="create-source">
        <h2 className="section-title">Add Acquisition Source</h2>

        <form action={createAcquisitionSourceAction} className="form-grid">
          <input type="hidden" name="itemId" value={item.id} />
          <input type="hidden" name="itemSlug" value={item.slug} />

          <label className="form-field">
            <span className="form-field-label">Type</span>
            <select name="type" required defaultValue="" className="form-input">
              <option value="" disabled>
                Select a type
              </option>
              {ACQUISITION_TYPES.map((type) => (
                <option key={type} value={type}>
                  {ACQUISITION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field-label">Location (optional)</span>
            <select name="locationId" defaultValue="" className="form-input">
              <option value="">No location</option>
              {locations.map((location) => (
                <option key={location.id} value={location.id}>
                  {location.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field-label">Profession (optional)</span>
            <select name="professionId" defaultValue="" className="form-input">
              <option value="">No profession</option>
              {professions.map((profession) => (
                <option key={profession.id} value={profession.id}>
                  {profession.name}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span className="form-field-label">
              Source label (optional — e.g. &quot;Seed Merchant&quot; or
              &quot;Vendor on Route 4&quot;)
            </span>
            <input type="text" name="sourceLabel" className="form-input" />
          </label>

          <label className="form-field">
            <span className="form-field-label">Quantity (optional)</span>
            <input type="text" name="quantity" className="form-input" />
          </label>

          <label className="form-field">
            <span className="form-field-label">Notes (optional)</span>
            <textarea name="notes" rows={3} className="form-input" />
          </label>

          <GameVersionVerificationControls gameVersions={gameVersions} />

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Add Source
            </button>
          </div>
        </form>
      </section>
    </AppShell>
  );
}
