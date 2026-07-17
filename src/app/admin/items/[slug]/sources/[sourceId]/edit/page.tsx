import { notFound } from "next/navigation";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";
import { prisma } from "@/lib/db";
import {
  ACQUISITION_TYPES,
  ACQUISITION_TYPE_LABELS,
} from "@/lib/validation/acquisition-source";
import { updateAcquisitionSourceAction } from "../../actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  missing_type: "Select an acquisition type.",
  invalid_type: "Select a valid acquisition type.",
  invalid_location: "Select an existing location, or choose No location.",
  invalid_profession: "Select an existing profession, or choose No profession.",
  no_current_version:
    "No Game Version is marked as current, so gameplay data cannot be marked as verified. Set the current version under Admin - Settings - Game Versions.",
  invalid_game_version:
    "The selected Game Version no longer exists, so gameplay data cannot be marked as verified. Refresh the page and try again.",
};

type EditAcquisitionSourcePageProps = {
  params: Promise<{ slug: string; sourceId: string }>;
  searchParams: Promise<{ error?: string }>;
};

export default async function EditAcquisitionSourcePage({
  params,
  searchParams,
}: EditAcquisitionSourcePageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug, sourceId } = await params;
  const { error } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;

  const [item, locations, professions] = await Promise.all([
    prisma.item.findUnique({ where: { slug } }),
    prisma.location.findMany({ orderBy: { name: "asc" } }),
    prisma.profession.findMany({ orderBy: { name: "asc" } }),
  ]);

  if (!item) {
    notFound();
  }

  const source = await prisma.acquisitionSource.findUnique({
    where: { id: sourceId },
    // Admin-only visibility of the verification stamp: the related Game
    // Version's name is shown next to the opt-in checkbox below.
    include: { verifiedGameVersion: true },
  });

  // The source must exist AND belong to this exact item — a source id from
  // a different item's URL is treated the same as a missing one.
  if (!source || source.itemId !== item.id) {
    notFound();
  }

  // Current version first, then newest — the same ordering the
  // settings list uses; feeds the shared verification picker.
  const gameVersions = await prisma.gameVersion.findMany({
    orderBy: [{ isCurrent: "desc" }, { createdAt: "desc" }],
  });

  return (
    <>
      <PageHeader
        eyebrow="Admin"
        title="Edit Acquisition Source"
        description={`Update how "${item.name}" can be obtained.`}
      />

      <p className="admin-toolbar">
        <a href={`/admin/items/${item.slug}/sources`} className="link-accent">
          &larr; Back to Acquisition Sources
        </a>
      </p>

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}

      <form action={updateAcquisitionSourceAction} className="form-grid">
        <input type="hidden" name="id" value={source.id} />
        <input type="hidden" name="itemSlug" value={item.slug} />

        <label className="form-field">
          <span className="form-field-label">Type</span>
          <select
            name="type"
            required
            defaultValue={source.type}
            className="form-input"
          >
            {ACQUISITION_TYPES.map((type) => (
              <option key={type} value={type}>
                {ACQUISITION_TYPE_LABELS[type]}
              </option>
            ))}
          </select>
        </label>

        <label className="form-field">
          <span className="form-field-label">Location (optional)</span>
          <select
            name="locationId"
            defaultValue={source.locationId ?? ""}
            className="form-input"
          >
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
          <select
            name="professionId"
            defaultValue={source.professionId ?? ""}
            className="form-input"
          >
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
          <input
            type="text"
            name="sourceLabel"
            defaultValue={source.sourceLabel ?? ""}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">Quantity (optional)</span>
          <input
            type="text"
            name="quantity"
            defaultValue={source.quantity ?? ""}
            className="form-input"
          />
        </label>

        <label className="form-field">
          <span className="form-field-label">Notes (optional)</span>
          <textarea
            name="notes"
            rows={3}
            defaultValue={source.notes ?? ""}
            className="form-input"
          />
        </label>

        {/* Admin-only verification status (public pages never show it).
            Rendered only when BOTH fields are populated — never as an
            empty row; the stable YYYY-MM-DD date never depends on the
            server locale. */}
        {source.verifiedAt && source.verifiedGameVersion ? (
          <p className="text-muted">
            Gameplay data verified for {source.verifiedGameVersion.name} on{" "}
            {source.verifiedAt.toISOString().slice(0, 10)}.
          </p>
        ) : null}

        <GameVersionVerificationControls gameVersions={gameVersions} />

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>

          <a href={`/admin/items/${item.slug}/sources`} className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </>
  );
}
