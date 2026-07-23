"use client";

// Shared accessible confirmation modal (Opus Pass 2) — the ONE dialog both
// the unsaved-changes discard prompt and the draft-recovery prompt render
// through, rather than window.confirm() (which cannot be styled, labelled,
// focus-managed, or made keyboard-accessible to the project's standard).
//
// Rendered INLINE (not through a portal) as a fixed-position overlay, so it
// composes cleanly with the server-rendered admin pages, needs no client
// portal target, and stays unit-testable as static markup. When `open` is
// false it renders nothing at all, so it costs nothing on a clean form and
// never appears during SSR.
//
// Accessibility: role="dialog" + aria-modal, labelled by its title and
// described by its message; the action chosen by `initialFocus` is focused
// on open; Escape and a backdrop click resolve as a DISMISS (which defaults
// to the cancel action, but a caller may override it — the draft-recovery
// prompt dismisses WITHOUT deleting the draft, so its Escape is neither
// "restore" nor "discard"); Tab / Shift+Tab are trapped within the dialog;
// focus returns to whatever was focused before it opened. No animation is
// used, so reduced-motion needs no special-casing.

import { useEffect, useId, useRef } from "react";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  description: string;
  /** The destructive/primary-action label (e.g. "Discard changes"). */
  confirmLabel: string;
  /** The secondary-action label (e.g. "Keep editing"). */
  cancelLabel: string;
  /** "danger" styles the confirm button as destructive; "primary" styles
      it as the safe/primary accent (used by the recovery prompt, whose
      confirm action — Restore — is the one to favor and is not
      destructive). */
  confirmTone?: "danger" | "primary";
  /** Which action receives initial focus. Defaults to "cancel" (the safe
      default for a discard-navigation prompt); the recovery prompt sets
      "confirm" so focus favors restoring the user's work. */
  initialFocus?: "confirm" | "cancel";
  onConfirm: () => void;
  onCancel: () => void;
  /** Escape / backdrop handler. Defaults to onCancel; the recovery prompt
      passes a distinct handler so dismissing preserves (never deletes) the
      draft. */
  onDismiss?: () => void;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel,
  confirmTone = "danger",
  initialFocus = "cancel",
  onConfirm,
  onCancel,
  onDismiss,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const confirmButtonRef = useRef<HTMLButtonElement>(null);
  // The element focused immediately before the dialog opened, restored on
  // close so focus returns to the navigation trigger.
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);

  const dismiss = onDismiss ?? onCancel;

  useEffect(() => {
    if (!open) {
      return;
    }

    previouslyFocusedRef.current =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;

    // Focus the caller's preferred action: the safe action for a discard
    // prompt, or the confirm action (Restore) for the recovery prompt.
    if (initialFocus === "confirm") {
      confirmButtonRef.current?.focus();
    } else {
      cancelButtonRef.current?.focus();
    }

    const previouslyFocused = previouslyFocusedRef.current;
    return () => {
      // Return focus to the trigger when the dialog closes.
      previouslyFocused?.focus?.();
    };
  }, [open, initialFocus]);

  if (!open) {
    return null;
  }

  function handleKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      dismiss();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    // Trap focus within the dialog.
    const dialog = dialogRef.current;
    if (!dialog) {
      return;
    }
    const focusable = Array.from(
      dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((element) => !element.hasAttribute("disabled"));
    if (focusable.length === 0) {
      return;
    }
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const active = document.activeElement;

    if (event.shiftKey && active === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && active === last) {
      event.preventDefault();
      first.focus();
    }
  }

  return (
    <div
      className="admin-modal-overlay"
      // A backdrop click resolves as a dismiss (for the discard prompt that
      // means Keep editing; for the recovery prompt it preserves the
      // draft). Clicks that originate inside the dialog do not bubble here.
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          dismiss();
        }
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        className="admin-modal"
        onKeyDown={handleKeyDown}
      >
        <h2 id={titleId} className="admin-modal-title">
          {title}
        </h2>
        <p id={descriptionId} className="admin-modal-message">
          {description}
        </p>
        <div className="admin-modal-actions">
          <button
            ref={cancelButtonRef}
            type="button"
            className="btn btn-secondary"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            ref={confirmButtonRef}
            type="button"
            className={
              confirmTone === "danger"
                ? "btn btn-danger-outline"
                : "btn btn-primary"
            }
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
