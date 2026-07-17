// Shared verification panel (Slice 9B.2): the contextual card the
// resource workspaces will show verification in. It COMPOSES the
// existing GameVersionVerificationControls (picker + opt-in checkbox) —
// never duplicating its rules — and adds the read-only facts around it:
// the current Game Version, the record's verified version and date, and
// an unverified/current/outdated status badge (classified by the pure
// rule in src/lib/admin/verification-status.ts). Admin-only by
// construction: it can only ever render inside admin pages, and server
// verification behavior is untouched — the panel proposes exactly what
// the existing controls proposed.

import { ContextPanel } from "@/components/admin/context-panel";
import {
  GameVersionVerificationControls,
  type GameVersionPickerOption,
} from "@/components/admin/game-version-verification-controls";
import {
  VERIFICATION_STATUS_LABELS,
  classifyVerificationStatus,
} from "@/lib/admin/verification-status";

type VerificationPanelProps = {
  /** Every Game Version, current first — the same list the picker uses. */
  gameVersions: GameVersionPickerOption[];
  /** The record's verification stamp (both null when unverified). */
  verifiedAt: Date | null;
  verifiedGameVersion: { id: string; name: string } | null;
};

const STATUS_BADGE_CLASSES = {
  unverified: "admin-status-badge",
  current: "admin-status-badge admin-status-badge-current",
  outdated: "admin-status-badge admin-status-badge-outdated",
} as const;

export function VerificationPanel({
  gameVersions,
  verifiedAt,
  verifiedGameVersion,
}: VerificationPanelProps) {
  const currentVersion = gameVersions.find((version) => version.isCurrent);

  const status = classifyVerificationStatus({
    verifiedAt,
    verifiedGameVersionId: verifiedGameVersion?.id ?? null,
    currentGameVersionId: currentVersion?.id ?? null,
  });

  return (
    <ContextPanel title="Verification">
      <p className="admin-panel-row">
        <span className={STATUS_BADGE_CLASSES[status]}>
          {VERIFICATION_STATUS_LABELS[status]}
        </span>
      </p>

      <dl style={{ margin: 0, display: "grid", gap: "6px" }}>
        <div className="admin-panel-row">
          <dt>Current version</dt>
          <dd>{currentVersion ? currentVersion.name : "None"}</dd>
        </div>

        {/* Rendered only when BOTH stamp fields are populated — never as
            empty rows; the stable YYYY-MM-DD date never depends on the
            server locale. */}
        {verifiedAt && verifiedGameVersion ? (
          <>
            <div className="admin-panel-row">
              <dt>Verified against</dt>
              <dd>{verifiedGameVersion.name}</dd>
            </div>
            <div className="admin-panel-row">
              <dt>Verified on</dt>
              <dd>{verifiedAt.toISOString().slice(0, 10)}</dd>
            </div>
          </>
        ) : null}
      </dl>

      <GameVersionVerificationControls gameVersions={gameVersions} />
    </ContextPanel>
  );
}
