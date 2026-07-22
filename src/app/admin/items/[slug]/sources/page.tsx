import { notFound } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { requireAdminUser } from "@/lib/auth/require-admin";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { ItemWorkspace } from "@/components/admin/item-workspace";
import {
  ITEM_LIST_PATH,
  itemEditorTabs,
  itemSourceDeleteHref,
  itemSourceEditHref,
  itemSourcesHref,
  normalizeItemSearchQuery,
  withItemSearchQuery,
} from "@/lib/admin/item-workspace";
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
  searchParams: Promise<{ q?: string; error?: string; success?: string }>;
};

export default async function AdminItemSourcesPage({
  params,
  searchParams,
}: AdminItemSourcesPageProps) {
  // Repeated here deliberately: this page stays protected through the
  // admin layout, but also re-runs the check itself rather than assuming it.
  await requireAdminUser();

  const { slug } = await params;
  const { q, error, success } = await searchParams;
  const errorMessage = error ? errorMessages[error] ?? "Something went wrong." : null;
  const successMessage = success ? successMessages[success] ?? null : null;
  const query = normalizeItemSearchQuery(q);

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

  const tabs = itemEditorTabs(item.slug, query, "sources");

  // The Acquisition Sources tab landing page (Slice 9B.6): the tab's own
  // list + quick-add page, integrated into the Item workspace exactly
  // like General — the record list stays visible and selected, and
  // switching records here (recordHref) keeps the NEXT item's Acquisition
  // Sources tab open, rather than dropping back to its General tab.
  return (
    <ItemWorkspace
      rawQuery={q}
      selectedSlug={item.slug}
      recordHref={itemSourcesHref}
      header={
        <>
          <EditorHeader
            eyebrow="Item"
            title={item.name}
            subtitle={item.slug}
            backHref={withItemSearchQuery(ITEM_LIST_PATH, query)}
            backLabel="Back to Item Management"
          />

          <EditorTabs label="Item editor sections" tabs={tabs} />

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
        </>
      }
    >
      <ContextPanel title="Existing Sources">
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
                          href={itemSourceEditHref(item.slug, source.id, query)}
                          className="link-accent"
                        >
                          Edit
                        </a>
                        <a
                          href={itemSourceDeleteHref(
                            item.slug,
                            source.id,
                            query
                          )}
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
      </ContextPanel>

      <ContextPanel title="Add Acquisition Source">
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
            <textarea name="notes" rows={4} className="form-input" />
          </label>

          {/* No fake existing verification state on create: both fields
              are null, so the panel renders Unverified with no stamp
              rows — exactly the state a brand-new source actually has. */}
          <VerificationPanel
            gameVersions={gameVersions}
            verifiedAt={null}
            verifiedGameVersion={null}
          />

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Add Source
            </button>
          </div>
        </form>
      </ContextPanel>
    </ItemWorkspace>
  );
}
