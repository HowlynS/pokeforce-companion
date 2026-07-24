// Two document-level signals coordinating the in-editor delete dialog
// (Admin Polish Pass 1, Part 5) with AdminFormGuard, which lives in a
// separate part of the component tree (the sticky actions row, inside the
// resource's own <form>) from the Danger Zone's delete trigger (the aside
// column, outside it) — there is no shared ancestor either page could hang
// state on without a much larger structural change to every editor page.
// Matches form-change-event.ts's own established shape exactly: a plain
// bubbling-free CustomEvent dispatched on `document`, since both signals
// are genuinely global to "this page" rather than scoped to one form.
//
//   - DELETE_DIALOG_STATE_EVENT: the delete trigger dispatches this
//     whenever its dialog opens/closes. AdminFormGuard listens so its own
//     Ctrl/Cmd+S handler can suppress a save while the delete dialog is
//     open (mirroring how it already suppresses Ctrl+S while its OWN
//     discard-navigation/draft-recovery prompts are open).
//   - EDITOR_DIRTY_STATE_EVENT: AdminFormGuard dispatches this whenever its
//     own dirty state changes. The delete trigger listens so it can show
//     an extra "unsaved edits will be lost" sentence in its dialog only
//     when the form is genuinely dirty at the moment Delete is opened.

export const DELETE_DIALOG_STATE_EVENT = "pf:delete-dialog-state";
export const EDITOR_DIRTY_STATE_EVENT = "pf:editor-dirty-state";

export type DeleteDialogStateDetail = { open: boolean };
export type EditorDirtyStateDetail = { dirty: boolean };

export function dispatchDeleteDialogState(open: boolean): void {
  try {
    document.dispatchEvent(
      new CustomEvent<DeleteDialogStateDetail>(DELETE_DIALOG_STATE_EVENT, {
        detail: { open },
      })
    );
  } catch {
    // CustomEvent unavailable (non-DOM environment) — nothing to signal.
  }
}

export function dispatchEditorDirtyState(dirty: boolean): void {
  try {
    document.dispatchEvent(
      new CustomEvent<EditorDirtyStateDetail>(EDITOR_DIRTY_STATE_EVENT, {
        detail: { dirty },
      })
    );
  } catch {
    // CustomEvent unavailable (non-DOM environment) — nothing to signal.
  }
}
