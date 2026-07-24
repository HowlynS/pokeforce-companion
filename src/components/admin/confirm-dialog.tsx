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
  /** Small-caps marker rendered above the title (the pre-existing
      .confirm-card-eyebrow treatment) — only the delete-confirmation
      dialog sets this ("Destructive action"); the two original callers
      leave it unset and render no eyebrow at all. */
  eyebrow?: string;
  title: string;
  /** A plain string for the two original callers; the delete-confirmation
      dialog passes a node so it can bold the record's own name inline. */
  description: React.ReactNode;
  /** Extra content rendered between the description and the action row —
      e.g. the delete-confirmation dialog's own resource-fact lines and
      blocked-reason text. Absent for the two original callers (the
      discard-navigation and draft-recovery prompts), which need only a
      single description sentence. */
  children?: React.ReactNode;
  /** The destructive/primary-action label (e.g. "Discard changes"). */
  confirmLabel: string;
  /** The secondary-action label (e.g. "Keep editing"). */
  cancelLabel: string;
  /** "danger" (outlined, the existing default) styles a destructive
      action that itself only LEADS to something destructive (Discard
      unsaved changes still just navigates away); "danger-solid" is the
      heavier full-fill treatment this codebase reserves for a button that
      IS the actual irreversible action (the delete-confirmation dialog's
      own Confirm, matching the pre-existing .confirm-card page's
      .btn-danger — never .btn-danger-outline, which stays for links that
      merely lead TO that page); "primary" styles it as the safe/primary
      accent (used by the recovery prompt, whose confirm action — Restore
      — is the one to favor and is not destructive). */
  confirmTone?: "danger" | "danger-solid" | "primary";
  /** Disables the confirm action without hiding it — the delete-
      confirmation dialog uses this while a live dependency still blocks
      deletion, so the reason (rendered via `children`) stays visible
      instead of the whole action disappearing. */
  confirmDisabled?: boolean;
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
  /** Renders Cancel as a real, navigable <a href> instead of a button —
      the delete-confirmation dialog's Cancel genuinely goes to a URL (the
      record's edit page), unlike the two original callers where Cancel
      only ever resolves an in-JS pending action. onCancel still fires for
      Escape/backdrop dismissal; the link itself carries no onClick, so a
      real click is an ordinary navigation (open in new tab, copy link,
      etc. all keep working). */
  cancelHref?: string;
};

const FOCUSABLE_SELECTOR =
  'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function ConfirmDialog({
  open,
  eyebrow,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel,
  confirmTone = "danger",
  confirmDisabled = false,
  initialFocus = "cancel",
  onConfirm,
  onCancel,
  onDismiss,
  cancelHref,
}: ConfirmDialogProps) {
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelButtonRef = useRef<HTMLButtonElement | HTMLAnchorElement>(null);
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
        {eyebrow ? (
          <p className="confirm-card-eyebrow">{eyebrow}</p>
        ) : null}
        <h2 id={titleId} className="admin-modal-title">
          {title}
        </h2>
        <p id={descriptionId} className="admin-modal-message">
          {description}
        </p>
        {children}
        <div className="admin-modal-actions">
          {cancelHref ? (
            <a
              ref={cancelButtonRef as React.Ref<HTMLAnchorElement>}
              href={cancelHref}
              className="btn btn-secondary"
            >
              {cancelLabel}
            </a>
          ) : (
            <button
              ref={cancelButtonRef as React.Ref<HTMLButtonElement>}
              type="button"
              className="btn btn-secondary"
              onClick={onCancel}
            >
              {cancelLabel}
            </button>
          )}
          <button
            ref={confirmButtonRef}
            type="button"
            disabled={confirmDisabled}
            className={
              confirmTone === "danger-solid"
                ? "btn btn-danger"
                : confirmTone === "primary"
                  ? "btn btn-primary"
                  : "btn btn-danger-outline"
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
