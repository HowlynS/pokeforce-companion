"use client";

import { useRef, useState } from "react";
import { RotateCcw } from "lucide-react";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";
import {
  APPEARANCE_RESET_DRAFT_EVENT,
  APPEARANCE_RESTORE_DEFAULTS_EVENT,
} from "@/components/admin/appearance-asset-field";
import { dispatchFormChange } from "@/lib/admin/form-change-event";

export function AppearanceRestoreDefaults() {
  const hiddenRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);

  function setRestoreAll(value: boolean) {
    setPending(value);
    requestAnimationFrame(() => dispatchFormChange(hiddenRef.current));
    window.dispatchEvent(
      new Event(
        value
          ? APPEARANCE_RESTORE_DEFAULTS_EVENT
          : APPEARANCE_RESET_DRAFT_EVENT
      )
    );
  }

  return (
    <>
      <input
        ref={hiddenRef}
        type="hidden"
        name="restoreAll"
        value={pending ? "on" : "off"}
      />
      <button
        type="button"
        className={
          pending
            ? "btn btn-secondary appearance-restore-pending"
            : "btn btn-danger-outline"
        }
        onClick={() => (pending ? setRestoreAll(false) : setOpen(true))}
      >
        <RotateCcw aria-hidden="true" />
        {pending ? "Undo restore all" : "Restore all defaults"}
      </button>

      <ConfirmDialog
        open={open}
        title="Restore all appearance defaults?"
        description="Every custom logo, favicon, wallpaper, and crop value will be replaced by the committed application defaults when you save."
        confirmLabel="Restore defaults"
        cancelLabel="Keep custom settings"
        confirmTone="danger-solid"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          setRestoreAll(true);
        }}
      />
    </>
  );
}
