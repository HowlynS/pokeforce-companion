"use client";

// Game Versions' own per-row Delete trigger (Admin Polish Pass 1, Part 5).
// Game Version has no dedicated "editor" page with a Danger Zone the way
// Item/Recipe/Profession/Category/Location/Acquisition Source do — Delete
// has always lived as a per-row action on the Game Versions LIST page
// instead (/admin/settings/game-versions/[id]/edit carries no delete
// action of its own, and this pass does not add one — see the module
// comment on why elsewhere). This opens the exact same DeleteRecordDialog
// in place over that list page instead of navigating to the dedicated
// /delete route, which is preserved unchanged as the fallback destination.
//
// Deliberately the FALLBACK design DeleteRecordDialog's own Part 5
// documentation allows: computing the real "how many verified records
// reference this version" count (countVerificationReferences) touches
// five tables per version, and running it for every row on every list
// view (rather than only when a contributor actually opens a delete
// dialog, as the dedicated page already does) would be a real, avoidable
// cost. canDelete is optimistically true here; Confirm submits to the
// unchanged deleteGameVersionAction, which re-validates authoritatively —
// a genuinely blocked version's redirect lands on the dedicated /delete
// page exactly as it always did, now showing the real count and reason.
//
// DELETE_DIALOG_STATE_EVENT is still dispatched here (see
// editor-overlay-events.ts) even though no AdminFormGuard lives inside
// THIS row's own markup: the same page also renders the Create Game
// Version form's own guard, and Ctrl/Cmd+S while this dialog is open must
// not fall through to it.

import { useState } from "react";
import { DeleteRecordDialog } from "@/components/admin/delete-record-dialog";
import { dispatchDeleteDialogState } from "@/lib/admin/editor-overlay-events";

type GameVersionDeleteActionProps = {
  id: string;
  name: string;
  isCurrent: boolean;
  releaseDateLabel: string;
  formAction: (formData: FormData) => void | Promise<void>;
};

export function GameVersionDeleteAction({
  id,
  name,
  isCurrent,
  releaseDateLabel,
  formAction,
}: GameVersionDeleteActionProps) {
  const [open, setOpen] = useState(false);

  function openDialog() {
    setOpen(true);
    dispatchDeleteDialogState(true);
  }

  function closeDialog() {
    setOpen(false);
    dispatchDeleteDialogState(false);
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-danger-outline btn-compact"
        onClick={openDialog}
      >
        Delete
      </button>

      {open ? (
        <DeleteRecordDialog
          open
          title="Delete Game Version"
          description={
            <>
              You are about to permanently delete <strong>{name}</strong>.
              This action cannot be undone.
            </>
          }
          canDelete
          formAction={formAction}
          hiddenFields={{ id }}
          onCancel={closeDialog}
        >
          <p className="text-muted">Release date: {releaseDateLabel}</p>
          <p className="text-muted">
            Current version: {isCurrent ? "Yes" : "No"}
          </p>
          {isCurrent ? (
            <p className="text-danger">
              This is the current game version. After deleting it no
              version will be current until you mark another one, and
              gameplay data cannot be marked as verified in the meantime.
            </p>
          ) : null}
        </DeleteRecordDialog>
      ) : null}
    </>
  );
}
