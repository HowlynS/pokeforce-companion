"use client";

// Shared accessible info-tooltip primitive (Opus Pass 1): the one small,
// discreet "circled i" trigger the admin forms use to tuck an optional
// field explanation behind a hover/focus/click affordance, instead of a
// permanent helper paragraph beneath every field. Resource-agnostic — it
// knows only its own accessible label and the text to reveal, never
// anything Recipe- (or any resource-) specific, so future admin forms
// reuse it unchanged.
//
// A thin client "island": the surrounding page stays an ordinary Server
// Component (the trigger is a plain <button type="button"> that never
// submits, so a form it lives inside is unaffected). Only the open/close
// state and the document listeners need the browser.
//
// Interaction model — a WAI-ARIA tooltip (role="tooltip" + the trigger's
// aria-describedby), enhanced so it also opens on click/tap and stays open
// for reading:
//   - Hover (fine pointers only): entering the trigger opens it; because
//     the tooltip content is a DOM descendant of this same wrapper,
//     moving the pointer from the trigger into the content never fires the
//     wrapper's pointerleave in between (no flicker), and the content sits
//     flush against the trigger (top: 100% + a transparent padding bridge)
//     so there is no dead gap to cross. Leaving the whole wrapper closes.
//     Gated to pointerType === "mouse" so a touch tap (which also fires
//     pointerenter on some browsers) never hover-opens then re-toggles.
//   - Keyboard: the trigger is a real, Tab-reachable button; focus opens,
//     blur (focus leaving the wrapper entirely) closes, Escape closes.
//   - Click/tap: opens (idempotent, never a blind toggle). A mouse click
//     is preceded by a hover-open, so toggling would close on click and
//     read as broken; opening on every activation is deterministic on
//     every device, and closing stays the job of Escape, blur, or an
//     outside pointerdown.
//   - Outside pointerdown closes — so opening a second tooltip (a
//     pointerdown outside the first) closes the first, and no two ever
//     stay open at once, without any shared/global state.
//
// The single document-listener effect runs ONLY while open and its
// cleanup removes exactly what it added, so nothing leaks after close or
// unmount. The ARIA id comes from useId() (stable across server/client,
// never Math.random), so the describedby relationship never mismatches on
// hydration and adjacent instances never collide.

import { useEffect, useId, useRef, useState } from "react";
import { Info } from "lucide-react";

type InfoTooltipProps = {
  /**
   * The accessible name of the trigger button, e.g. "More information
   * about Minimum quantity". The visible icon is decorative (aria-hidden),
   * so this is the button's ONLY accessible name.
   */
  label: string;
  /** The explanatory text revealed when the tooltip opens. */
  content: string;
};

export function InfoTooltip({ label, content }: InfoTooltipProps) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLSpanElement>(null);
  const contentId = useId();

  useEffect(() => {
    if (!open) {
      return;
    }

    function handlePointerDown(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
      }
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open]);

  return (
    <span
      ref={wrapperRef}
      className="admin-info-tooltip"
      onPointerEnter={(event) => {
        if (event.pointerType === "mouse") {
          setOpen(true);
        }
      }}
      onPointerLeave={(event) => {
        if (event.pointerType === "mouse") {
          setOpen(false);
        }
      }}
      onBlur={(event) => {
        if (!wrapperRef.current?.contains(event.relatedTarget as Node | null)) {
          setOpen(false);
        }
      }}
    >
      <button
        type="button"
        className="admin-info-tooltip-trigger"
        aria-label={label}
        aria-describedby={contentId}
        data-open={open ? "true" : undefined}
        onFocus={() => setOpen(true)}
        onClick={() => setOpen(true)}
      >
        <Info
          className="admin-info-tooltip-icon"
          aria-hidden="true"
          focusable="false"
        />
      </button>

      {/* Always in the DOM so the aria-describedby relationship is stable,
          but `hidden` (and therefore neither announced nor visible, nor
          affecting layout) until open. The outer wrapper carries the
          transparent hover bridge; the inner surface carries the visible
          styling. */}
      <span
        role="tooltip"
        id={contentId}
        className="admin-info-tooltip-content"
        hidden={!open}
      >
        <span className="admin-info-tooltip-surface">{content}</span>
      </span>
    </span>
  );
}
