import { notFound } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageHeader } from "@/components/layout/page-header";
import { requireAdminUser } from "@/lib/auth/require-admin";
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
  missing_build_id:
    "The current game build is not configured on the server, so gameplay data cannot be marked as verified.",
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
  });

  // The source must exist AND belong to this exact item — a source id from
  // a different item's URL is treated the same as a missing one.
  if (!source || source.itemId !== item.id) {
    notFound();
  }

  return (
    <AppShell>
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

        {/* Explicit per-save action, deliberately never pre-checked (even
            when the record is already verified): the stamped timestamp and
            build id come from the server, and an unchecked box leaves
            existing verification metadata untouched. */}
        <label className="form-checkbox-field">
          <input type="checkbox" name="markVerified" />
          <span>Mark gameplay data as verified for the current build.</span>
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            Save Changes
          </button>

          <a href={`/admin/items/${item.slug}/sources`} className="btn btn-secondary">
            Cancel
          </a>
        </div>
      </form>
    </AppShell>
  );
}
