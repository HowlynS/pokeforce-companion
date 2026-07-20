// Shared timestamps panel (Slice 9B.2): the record's created and updated
// dates, plus the verification date when one exists. Stable YYYY-MM-DD
// formatting (the project-wide convention) so output never depends on
// the server locale. Deliberately NO database ids or other debugging
// metadata — this panel is for contributors, not for diagnostics.

import { ContextPanel } from "@/components/admin/context-panel";

type TimestampsPanelProps = {
  createdAt: Date;
  updatedAt: Date;
  /** Included as a row only when the record carries a verification stamp. */
  verifiedAt?: Date | null;
};

function formatStableDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

export function TimestampsPanel({
  createdAt,
  updatedAt,
  verifiedAt,
}: TimestampsPanelProps) {
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

        {verifiedAt ? (
          <div className="admin-panel-row">
            <dt>Verified</dt>
            <dd>{formatStableDate(verifiedAt)}</dd>
          </div>
        ) : null}
      </dl>
    </ContextPanel>
  );
}
