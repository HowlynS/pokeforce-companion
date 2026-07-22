// Shared right-rail Danger zone (Visual Pass sub-slice 9): Delete moved
// out of the sticky Save/Cancel action bar into its own panel, placed
// below Timestamps in the aside column. Deliberately restrained relative
// to the confirm-card treatment on the actual confirmation page — this
// is a navigational link to that existing route, never a second
// destructive submit. Preserves the exact confirmation-route/dependency-
// check behavior every resource already had; only the link's location
// moved.

import { ContextPanel } from "@/components/admin/context-panel";

type DangerZonePanelProps = {
  /** e.g. "item", "recipe", "location" — used only in the description
      sentence below, never in the link label itself. */
  resourceLabel: string;
  deleteHref: string;
  deleteLabel: string;
};

export function DangerZonePanel({
  resourceLabel,
  deleteHref,
  deleteLabel,
}: DangerZonePanelProps) {
  return (
    <ContextPanel title="Danger zone" className="admin-danger-zone">
      <p className="admin-danger-zone-description">
        Deleting this {resourceLabel} is permanent once any dependencies
        that block it are cleared.
      </p>

      <a href={deleteHref} className="btn btn-danger">
        {deleteLabel}
      </a>
    </ContextPanel>
  );
}
