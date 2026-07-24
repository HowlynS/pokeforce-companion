"use client";

// The ONE verification control block shared by every verifiable resource's
// admin create/edit form (Items, Locations, Acquisition Sources, Recipes,
// Professions): a restrained Game Version picker plus the explicit opt-in
// checkbox. Deliberately compatibility UI only — it slots into the existing
// form-grid layouts and is NOT part of the deferred Slice 9B workspace
// redesign.
//
// Server-trust model (unchanged): the picker only proposes a version id;
// resolveVerificationStamp validates that a submitted id names a real
// GameVersion row (rejecting tampered ids), falls back to the row marked
// current when the value is blank, and stamps verifiedAt from the server
// clock. Changing the picker alone never writes anything — verification
// metadata moves only when the checkbox is checked on submit.
//
// A client component only for the checkbox's own dynamic label text
// (Visual Pass sub-slice 7: "Mark as verified for {selected version}"),
// which needs to track the picker's live selection — every other
// behavior stays exactly the same uncontrolled, plain HTML submission.

import { useState } from "react";
import { AdminSelect } from "@/components/admin/admin-select";

export type GameVersionPickerOption = {
  id: string;
  name: string;
  isCurrent: boolean;
};

type GameVersionVerificationControlsProps = {
  gameVersions: GameVersionPickerOption[];
  /** Associates the picker and checkbox with a <form> element elsewhere
      in the document (the standard HTML `form` attribute) — needed when
      these controls render inside a contextual side panel that sits
      outside the resource's own <form> (e.g. VerificationPanel in an
      editor's aside column). Omitted when rendered as a normal form
      descendant, exactly as before. */
  formId?: string;
};

export function GameVersionVerificationControls({
  gameVersions,
  formId,
}: GameVersionVerificationControlsProps) {
  const currentVersion = gameVersions.find((version) => version.isCurrent);

  // Tracks the picker's own live selection only for the checkbox's
  // display label below — never sent anywhere itself; the submitted
  // value always comes from the <select> element's own name/value.
  const [selectedId, setSelectedId] = useState(currentVersion?.id ?? "");

  // Without any versions there is nothing to verify against: say so
  // plainly and point at the existing settings destination instead of
  // rendering a picker that could only fail on submit.
  if (gameVersions.length === 0) {
    return (
      <p className="text-muted">
        No game versions exist yet, so gameplay data cannot be marked as
        verified. Create one under{" "}
        <a href="/admin/settings/game-versions" className="link-accent">
          Game Versions
        </a>{" "}
        in the admin settings first.
      </p>
    );
  }

  const selectedVersion = gameVersions.find(
    (version) => version.id === selectedId
  );
  const checkboxLabel = selectedVersion
    ? `Mark as verified for ${selectedVersion.name}`
    : "Mark as verified for the selected version";

  return (
    <>
      <label className="form-field">
        <span className="form-field-label">Verify this record for</span>
        {/* Defaults to the current version when one exists; historical
            versions stay selectable. When nothing is current the explicit
            placeholder stays selected — a historical version is never
            silently chosen, and submitting the blank value falls back to
            the server-side current-version rule (which then fails with a
            clear message precisely because nothing is current). */}
        <AdminSelect
          name="verifiedGameVersionId"
          defaultValue={currentVersion?.id ?? ""}
          formId={formId}
          placeholder={!currentVersion ? "Select a game version…" : undefined}
          onValueChange={setSelectedId}
          options={gameVersions.map((version) => ({
            value: version.id,
            label: version.isCurrent ? `${version.name} (current)` : version.name,
          }))}
        />
      </label>

      {/* Explicit per-save action, deliberately never pre-checked (even
          when the record is already verified): the stamped timestamp comes
          from the server clock and the version reference from the
          server-validated selection, and an unchecked box leaves existing
          verification metadata untouched no matter what the picker says. */}
      <label className="form-checkbox-field">
        <input type="checkbox" name="markVerified" form={formId} />
        <span>{checkboxLabel}</span>
      </label>
    </>
  );
}
