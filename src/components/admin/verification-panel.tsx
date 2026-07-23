// Shared verification panel (Slice 9B.2; simplified in Visual Pass
// sub-slice 7): the contextual card the resource workspaces show
// verification in. It COMPOSES the existing GameVersionVerificationControls
// (picker + opt-in checkbox) — never duplicating its rules — and adds the
// read-only facts around it: the current Game Version, the record's
// verified version and date, and an unverified/current/outdated status
// badge (classified by the pure rule in
// src/lib/admin/verification-status.ts). Admin-only by construction: it
// can only ever render inside admin pages, and server verification
// behavior is untouched — the panel proposes exactly what the existing
// controls proposed. The controls render through ContextPanel's own
// footer slot, whose existing border-top styling doubles as the clear
// divider the mock-up calls for between "current state" and "the action
// to change it" — no new CSS was needed for that separation.

import { ContextPanel } from "@/components/admin/context-panel";
import {
  GameVersionVerificationControls,
  type GameVersionPickerOption,
} from "@/components/admin/game-version-verification-controls";
import {
  VERIFICATION_STATUS_LABELS,
  classifyVerificationStatus,
} from "@/lib/admin/verification-status";
import { formatDisplayDate } from "@/lib/format-date";
import { SECTION_ICONS } from "@/lib/admin/section-icons";

type VerificationPanelProps = {
  /** Every Game Version, current first — the same list the picker uses. */
  gameVersions: GameVersionPickerOption[];
  /** The record's verification stamp (both null when unverified). */
  verifiedAt: Date | null;
  verifiedGameVersion: { id: string; name: string } | null;
  /** Forwarded to the composed controls — needed when this panel renders
      in an editor's aside column, outside the resource's own <form>. */
  formId?: string;
  /** Omits the composed picker/checkbox entirely, leaving only the
      status badge and the read-only rows below it (the read-only
      Metadata-style surfaces still using this panel). */
  readOnly?: boolean;
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
  formId,
  readOnly = false,
}: VerificationPanelProps) {
  const currentVersion = gameVersions.find((version) => version.isCurrent);

  const status = classifyVerificationStatus({
    verifiedAt,
    verifiedGameVersionId: verifiedGameVersion?.id ?? null,
    currentGameVersionId: currentVersion?.id ?? null,
  });

  const verifiedVersionName = verifiedAt && verifiedGameVersion
    ? verifiedGameVersion.name
    : null;

  return (
    <ContextPanel
      title="Verification"
      icon={SECTION_ICONS.verification}
      footer={
        readOnly ? null : (
          <GameVersionVerificationControls
            gameVersions={gameVersions}
            formId={formId}
          />
        )
      }
    >
      <p className="admin-panel-row">
        <span className={STATUS_BADGE_CLASSES[status]}>
          {VERIFICATION_STATUS_LABELS[status]}
        </span>
      </p>

      <dl className="admin-panel-dl">
        <div className="admin-panel-row">
          <dt>Current version</dt>
          <dd>
            {/* Visual Pass II correction pass: the redundant green
                "Current" pill beside the version's own name was removed —
                this row's LABEL ("Current version") already says exactly
                that, so the badge repeated the same fact a second time.
                The status badge above (Unverified/Verified — current
                version/Verified — older version) is untouched. */}
            {currentVersion ? currentVersion.name : "None"}
          </dd>
        </div>

        {/* Rendered only when BOTH stamp fields are populated — never as
            empty rows; formatted through the shared formatDisplayDate
            helper ("DD MMM YYYY") so it never depends on the server
            locale. Technical version names display exactly as stored,
            with no reformatting. */}
        {verifiedVersionName ? (
          <>
            <div className="admin-panel-row">
              <dt>Verified for</dt>
              <dd>{verifiedVersionName}</dd>
            </div>
            <div className="admin-panel-row">
              <dt>Verified on</dt>
              <dd>{formatDisplayDate(verifiedAt)}</dd>
            </div>
          </>
        ) : null}
      </dl>
    </ContextPanel>
  );
}
