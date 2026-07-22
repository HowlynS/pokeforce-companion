// Shared timestamps panel (Slice 9B.2; trimmed in Visual Pass sub-slice
// 7): the record's created and updated dates. The verification date used
// to repeat here too, but VerificationPanel's own "Verified on" row
// already shows it clearly next to the version it was verified for, so
// the duplicate row was removed — Created/Updated are the only facts
// unique to this panel now. Stable YYYY-MM-DD formatting (the
// project-wide convention) so output never depends on the server locale.
// Deliberately NO database ids or other debugging metadata — this panel
// is for contributors, not for diagnostics.

import { ContextPanel } from "@/components/admin/context-panel";

type TimestampsPanelProps = {
  createdAt: Date;
  updatedAt: Date;
};

function formatStableDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function TimestampsPanel({ createdAt, updatedAt }: TimestampsPanelProps) {
  return (
    <ContextPanel title="Timestamps">
      <dl className="admin-panel-dl">
        <div className="admin-panel-row">
          <dt>Created</dt>
          <dd>{formatStableDate(createdAt)}</dd>
        </div>

        <div className="admin-panel-row">
          <dt>Updated</dt>
          <dd>{formatStableDate(updatedAt)}</dd>
        </div>
      </dl>
    </ContextPanel>
  );
}
