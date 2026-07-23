// Shared timestamps panel (Slice 9B.2; trimmed in Visual Pass sub-slice
// 7): the record's created and updated dates. The verification date used
// to repeat here too, but VerificationPanel's own "Verified on" row
// already shows it clearly next to the version it was verified for, so
// the duplicate row was removed — Created/Updated are the only facts
// unique to this panel now. Formatted through the shared, unit-tested
// formatDisplayDate helper ("DD MMM YYYY") — the project-wide convention
// (Admin Visual/UX Correction pass, Part 9) — so output never depends on
// the server locale and never shifts a UTC-stored day. Deliberately NO
// database ids or other debugging metadata — this panel is for
// contributors, not for diagnostics.

import { ContextPanel } from "@/components/admin/context-panel";
import { formatDisplayDate } from "@/lib/format-date";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

type TimestampsPanelProps = {
  createdAt: Date;
  updatedAt: Date;
};

export function TimestampsPanel({ createdAt, updatedAt }: TimestampsPanelProps) {
  return (
    <ContextPanel title="Timestamps" icon={SECTION_ICONS.timestamps}>
      <dl className="admin-panel-dl">
        <div className="admin-panel-row">
          <dt>Created</dt>
          <dd>{formatDisplayDate(createdAt)}</dd>
        </div>

        <div className="admin-panel-row">
          <dt>Updated</dt>
          <dd>{formatDisplayDate(updatedAt)}</dd>
        </div>
      </dl>
    </ContextPanel>
  );
}
