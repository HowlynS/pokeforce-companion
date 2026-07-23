"use client";

// Shared autosizing textarea (Admin Visual/UX Correction pass, follow-up
// #2): the one place every admin multiline field grows with its own
// content, instead of every page hand-rolling the same resize logic (or,
// as before this pass, staying pinned at a fixed 4-row height and
// scrolling internally the moment pasted content exceeded it). A thin
// client "island" wrapping a plain, uncontrolled `<textarea>` — the
// surrounding page stays an ordinary Server Component form; only the
// height-measuring behavior needs the browser.
//
// Sizing lives in CSS (.admin-autosize-textarea's min-height/max-height,
// in rem — see globals.css), not hardcoded pixel literals here: the
// resize logic reads those two computed values back out via
// getComputedStyle, so it automatically respects the visitor's own root
// font size (browser zoom, OS text-size preferences) exactly the way a
// plain CSS min-height/max-height pair always would, and the sizing
// values are declared in exactly one place.
//
// Manual vertical resize (the browser's native textarea resize handle)
// is deliberately disabled (`resize: none`, in the same CSS class): free
// manual resize fights the very JS that keeps recomputing height from
// content on every keystroke — a user's manual drag would be silently
// overwritten the next time they typed a character, which reads as a
// bug, not a resize. Predictable autosizing was chosen over free manual
// resize, project-wide, rather than half-supporting both.
//
// Every prop (name, defaultValue, required, rows, aria-*, ...) is
// forwarded straight through to the native element — this component
// changes ONLY the element's rendered height and overflow behavior, never
// its value, validation, or how it submits. A field using this component
// is exactly as uncontrolled as a plain <textarea defaultValue="..."> —
// no value prop is read or set here, so existing server actions receive
// the exact same FormData shape as before.

import { useLayoutEffect, useRef } from "react";
import type { TextareaHTMLAttributes } from "react";

type AutosizeTextareaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

/**
 * Resizes `el` to fit its current content, clamped between the CSS
 * min-height/max-height already declared on it. `height: "auto"` is set
 * FIRST — without it, `scrollHeight` would keep reporting the box's own
 * previous (possibly taller) rendered height rather than the height its
 * current content actually needs, so shrinking content would never
 * shrink the box back down. Only switches on internal scrolling
 * (`overflow-y: auto`) once content genuinely exceeds the max — never
 * before, so no scrollbar appears while the box is still free to grow.
 */
function resizeToContent(el: HTMLTextAreaElement): void {
  const computed = getComputedStyle(el);
  const minHeight = parseFloat(computed.minHeight) || 0;
  const maxHeight = parseFloat(computed.maxHeight) || Number.POSITIVE_INFINITY;

  el.style.height = "auto";
  const contentHeight = el.scrollHeight;
  const nextHeight = Math.min(Math.max(contentHeight, minHeight), maxHeight);

  el.style.height = `${nextHeight}px`;
  el.style.overflowY = contentHeight > maxHeight ? "auto" : "hidden";
}

export function AutosizeTextarea({
  className,
  onChange,
  ...props
}: AutosizeTextareaProps) {
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Sets the CORRECT initial height (from persisted defaultValue content,
  // e.g. a long saved description) before the browser paints —
  // useLayoutEffect, not useEffect, so there is no visible flash of the
  // wrong height first. This mutates the DOM node directly via the ref,
  // never through React's own `style` prop reconciliation, so it can
  // never disagree with server-rendered markup — no hydration mismatch
  // is possible here.
  useLayoutEffect(() => {
    if (textareaRef.current) {
      resizeToContent(textareaRef.current);
    }
  }, []);

  return (
    <textarea
      ref={textareaRef}
      className={
        className
          ? `admin-autosize-textarea ${className}`
          : "admin-autosize-textarea"
      }
      onChange={(event) => {
        // Covers typing AND paste identically — React's onChange for a
        // textarea fires on the native "input" event, which fires only
        // after pasted content has already been inserted into the
        // value, so scrollHeight here always reflects the post-paste
        // content.
        resizeToContent(event.currentTarget);
        onChange?.(event);
      }}
      {...props}
    />
  );
}
