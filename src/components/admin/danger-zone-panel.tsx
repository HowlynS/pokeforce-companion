"use client";

// Shared right-rail Danger zone (Visual Pass sub-slice 9; converted to an
// in-editor delete dialog in Admin Polish Pass 1, Part 5). Delete now opens
// the shared DeleteRecordDialog directly over the current editor — the
// editor stays fully visible and untouched underneath a dimmed backdrop,
// no route change, no lost scroll position or field values — instead of
// navigating to the resource's dedicated /delete page. That page is
// deliberately NOT removed: it is still exactly where every delete server
// action's own blocked/failed redirect lands (see delete-record-dialog.tsx's
// own module comment), still reachable directly, and still the same
// fallback route the project's E2E suite exercises directly.
//
// Because this is now a real button rather than an <a href>, AdminFormGuard
// never sees a navigation click to intercept — opening Delete on a dirty
// form shows ONLY this dialog, never a second "Discard unsaved changes?"
// prompt stacked on top (that prompt only ever fires for actual link
// clicks). The dialog's own open/closed state is dispatched via
// DELETE_DIALOG_STATE_EVENT purely so AdminFormGuard's Ctrl/Cmd+S handler
// (in a different, non-ancestor part of the tree — the sticky actions row
// inside the <form>, not this aside panel) can suppress a save while this
// is open; EDITOR_DIRTY_STATE_EVENT is the reverse signal, letting this
// panel show an extra "unsaved edits will be lost" sentence only when the
// form is genuinely dirty. See editor-overlay-events.ts for both.

import { useEffect, useState } from "react";
import { ContextPanel } from "@/components/admin/context-panel";
import { DeleteRecordDialog } from "@/components/admin/delete-record-dialog";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import {
  EDITOR_DIRTY_STATE_EVENT,
  dispatchDeleteDialogState,
  type EditorDirtyStateDetail,
} from "@/lib/admin/editor-overlay-events";

type DangerZonePanelProps = {
  /** e.g. "item", "recipe", "location" — used only in the description
      sentence below, never in the link label itself. */
  resourceLabel: string;
  deleteLabel: string;
  /** The dialog's own title, e.g. "Delete Item". */
  dialogTitle: string;
  /** The lead "You are about to permanently delete <strong>Name</strong>…"
      sentence — a node so the record's own name can be bolded inline. */
  dialogDescription: React.ReactNode;
  /** The resource-specific fact lines (and, when blocked, the existing
      text-danger explanation) the dedicated /delete page also renders. */
  children?: React.ReactNode;
  canDelete: boolean;
  /** The existing server action this resource's delete form already
      posted to — unchanged. */
  formAction: (formData: FormData) => void | Promise<void>;
  /** The exact hidden fields the existing form already carried (e.g.
      { id, slug }). */
  hiddenFields: Record<string, string>;
};

export function DangerZonePanel({
  resourceLabel,
  deleteLabel,
  dialogTitle,
  dialogDescription,
  children,
  canDelete,
  formAction,
  hiddenFields,
}: DangerZonePanelProps) {
  const [open, setOpen] = useState(false);
  const [editorDirty, setEditorDirty] = useState(false);

  useEffect(() => {
    function onDirtyState(event: Event) {
      setEditorDirty(
        (event as CustomEvent<EditorDirtyStateDetail>).detail.dirty
      );
    }
    document.addEventListener(EDITOR_DIRTY_STATE_EVENT, onDirtyState);
    return () =>
      document.removeEventListener(EDITOR_DIRTY_STATE_EVENT, onDirtyState);
  }, []);

  function openDialog() {
    setOpen(true);
    dispatchDeleteDialogState(true);
  }

  function closeDialog() {
    setOpen(false);
    dispatchDeleteDialogState(false);
  }

  return (
    <ContextPanel
      title="Danger zone"
      icon={SECTION_ICONS.dangerZone}
      className="admin-danger-zone"
    >
      <p className="admin-danger-zone-description">
        Deleting this {resourceLabel} is permanent once any dependencies
        that block it are cleared.
      </p>

      <button
        type="button"
        className="btn btn-danger-outline"
        onClick={openDialog}
      >
        {deleteLabel}
      </button>

      {open ? (
        <DeleteRecordDialog
          open
          title={dialogTitle}
          description={dialogDescription}
          canDelete={canDelete}
          formAction={formAction}
          hiddenFields={hiddenFields}
          onCancel={closeDialog}
        >
          {editorDirty ? (
            <p className="text-danger">
              This editor has unsaved changes. They will be lost if the
              deletion succeeds.
            </p>
          ) : null}
          {children}
        </DeleteRecordDialog>
      ) : null}
    </ContextPanel>
  );
}
