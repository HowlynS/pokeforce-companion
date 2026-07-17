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

export type GameVersionPickerOption = {
  id: string;
  name: string;
  isCurrent: boolean;
};

type GameVersionVerificationControlsProps = {
  gameVersions: GameVersionPickerOption[];
};

export function GameVersionVerificationControls({
  gameVersions,
}: GameVersionVerificationControlsProps) {
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

  const currentVersion = gameVersions.find((version) => version.isCurrent);

  return (
    <>
      <label className="form-field">
        <span className="form-field-label">Game version to verify against</span>
        {/* Defaults to the current version when one exists; historical
            versions stay selectable. When nothing is current the explicit
            placeholder stays selected — a historical version is never
            silently chosen, and submitting the blank value falls back to
            the server-side current-version rule (which then fails with a
            clear message precisely because nothing is current). */}
        <select
          name="verifiedGameVersionId"
          defaultValue={currentVersion?.id ?? ""}
          className="form-input"
        >
          {!currentVersion ? (
            <option value="">Select a game version…</option>
          ) : null}
          {gameVersions.map((version) => (
            <option key={version.id} value={version.id}>
              {version.isCurrent ? `${version.name} (current)` : version.name}
            </option>
          ))}
        </select>
      </label>

      {/* Explicit per-save action, deliberately never pre-checked (even
          when the record is already verified): the stamped timestamp comes
          from the server clock and the version reference from the
          server-validated selection, and an unchecked box leaves existing
          verification metadata untouched no matter what the picker says. */}
      <label className="form-checkbox-field">
        <input type="checkbox" name="markVerified" />
        <span>Mark gameplay data as verified for the selected game version.</span>
      </label>
    </>
  );
}
