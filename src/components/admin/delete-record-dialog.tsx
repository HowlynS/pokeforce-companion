"use client";

// Shared destructive-confirmation dialog (Massive Admin Interaction
// Completion Pass, Phase 2). Every resource's dedicated `/delete` route
// keeps its own server-rendered data fetching, live dependency-count
// query, and `canDelete` gate byte-for-byte unchanged — only the page's
// hand-written `.confirm-card` markup is replaced with this, which reuses
// ConfirmDialog's exact modal chrome (role="dialog", focus trap, Escape/
// backdrop dismiss) instead of a plain card.
//
// The dedicated route itself is deliberately NOT eliminated: the existing
// delete server actions (deleteItemAction etc.) redirect back to that exact
// route on a blocked/failed delete (see e.g. `${confirmPath}?error=...` in
// src/app/admin/items/actions.ts) — changing that target would be a
// server-action-contract change, out of scope for a presentation-only
// pass. Reaching this page is still an ordinary link click (DangerZonePanel
// or a per-row Delete link), so AdminFormGuard's existing dirty-form
// discard-prompt (see admin-form-guard.tsx's onCaptureClick, which only
// intercepts when the form is genuinely dirty) still runs first and
// sequentially — never simultaneously — when Delete is clicked from a
// dirty edit form; this dialog only ever mounts on a fresh page load of a
// route that never carries its own AdminFormGuard, so there is no modal
// stacking to guard against here.
//
// The actual deletion still goes through the exact same <form
// action={deleteXAction}> every page already had, with the same hidden
// id/slug fields — Confirm calls requestSubmit() on it rather than being a
// submit button itself, since ConfirmDialog's own two actions are plain
// buttons. Cancel/Escape/backdrop all navigate to the same cancelHref the
// page's old Cancel link already pointed at.

import { useRef } from "react";
import { useRouter } from "next/navigation";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

type DeleteRecordDialogProps = {
  title: string;
  /** The lead "You are about to permanently delete <strong>Name</strong>…"
      sentence — a node so the record's own name can be bolded inline. */
  description: React.ReactNode;
  /** The resource-specific fact lines (and, when blocked, the existing
      text-danger explanation) — each caller composes exactly what its own
      confirm-card used to render directly. */
  children?: React.ReactNode;
  /** Disables Confirm without hiding it, so the blocked-reason text in
      `children` stays visible instead of the whole action disappearing. */
  canDelete: boolean;
  confirmLabel?: string;
  /** The existing server action this resource's delete form already
      posted to — unchanged. */
  formAction: (formData: FormData) => void | Promise<void>;
  /** The exact hidden fields the existing form already carried (e.g.
      { id, slug } or { id, itemSlug }). */
  hiddenFields: Record<string, string>;
  /** Where Cancel/Escape/backdrop navigate — the same route the page's own
      Cancel link already used. */
  cancelHref: string;
};

export function DeleteRecordDialog({
  title,
  description,
  children,
  canDelete,
  confirmLabel = "Delete Permanently",
  formAction,
  hiddenFields,
  cancelHref,
}: DeleteRecordDialogProps) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);

  function handleCancel() {
    router.push(cancelHref);
  }

  return (
    <>
      <ConfirmDialog
        open
        eyebrow="Destructive action"
        title={title}
        description={description}
        confirmLabel={confirmLabel}
        cancelLabel="Cancel"
        cancelHref={cancelHref}
        confirmTone="danger-solid"
        confirmDisabled={!canDelete}
        initialFocus="cancel"
        onConfirm={() => formRef.current?.requestSubmit()}
        onCancel={handleCancel}
        onDismiss={handleCancel}
      >
        {children}
      </ConfirmDialog>
      {/* Deliberately rendered OUTSIDE the dialog's own markup (never
          inside ConfirmDialog's children): its hidden inputs match
          FOCUSABLE_SELECTOR's bare `input` clause (which does not exclude
          type="hidden") even though a browser can never actually focus
          them, which corrupted the dialog's Tab-wrap-around calculation
          when this form lived inside it. Position in the document is
          otherwise irrelevant — requestSubmit() only needs the ref. */}
      <form ref={formRef} action={formAction} hidden>
        {Object.entries(hiddenFields).map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
      </form>
    </>
  );
}
