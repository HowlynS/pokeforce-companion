"use client";

import {
  useEffect,
  useId,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { formatDisplayDate } from "@/lib/format-date";
import type { PublicVerificationStamp } from "@/lib/public-verification";

type VerificationStatusProps = {
  stamp: PublicVerificationStamp;
  className?: string;
};

/**
 * Discreet, always-discoverable verification cue for a public resource hero.
 * One accessible control handles every input method: hover reveals it for a
 * pointer, focus reveals it for the keyboard, and a click/tap toggles it for
 * touch -- never a hover-only, keyboard-inaccessible tooltip.
 *
 * Verified and Unverified are the same component with different content, so
 * the interaction and popover shell can never drift between the two states.
 * Only fields the record actually carries are shown; an incomplete stamp
 * renders as Unverified rather than guessing a build or date.
 */
export function VerificationStatus({ stamp, className }: VerificationStatusProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const panelId = useId();

  const verifiedDate = formatDisplayDate(stamp.verifiedAt);
  const isVerified = Boolean(stamp.verifiedGameVersion && verifiedDate);

  useEffect(() => {
    if (!open) return;

    function dismiss(event: MouseEvent) {
      const root = rootRef.current;
      if (!root || !(event.target instanceof Node)) return;
      if (!root.contains(event.target)) setOpen(false);
    }

    document.addEventListener("click", dismiss, true);
    return () => document.removeEventListener("click", dismiss, true);
  }, [open]);

  // Reveal is partly CSS-only (:hover / :focus-within, for pointer hover and
  // keyboard focus), so Escape has to work even when `open` was never set --
  // handled on the root itself rather than gated behind the `open` effect
  // above, and it blurs the focused control so :focus-within can't silently
  // re-open the panel a frame later.
  function dismissOnEscape(event: ReactKeyboardEvent<HTMLDivElement>) {
    if (event.key !== "Escape") return;
    setOpen(false);
    const root = rootRef.current;
    if (root && root.contains(document.activeElement)) {
      (document.activeElement as HTMLElement | null)?.blur();
    }
  }

  const classes = [
    "verification-status",
    isVerified ? "verification-status--verified" : "verification-status--unverified",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={classes} ref={rootRef} onKeyDown={dismissOnEscape}>
      <button
        type="button"
        className="verification-status-trigger"
        aria-expanded={open}
        aria-controls={panelId}
        aria-label={
          isVerified
            ? `Verified gameplay data. ${stamp.verifiedGameVersion!.name}, ${verifiedDate}`
            : "Unverified gameplay data"
        }
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true">{isVerified ? "✓" : "?"}</span>
        <span>{isVerified ? "Verified" : "Unverified"}</span>
      </button>
      <div
        id={panelId}
        className="verification-status-panel"
        role="status"
        data-open={open || undefined}
      >
        {isVerified ? (
          <>
            <p className="verification-status-heading">Verified gameplay data</p>
            <p>
              Verified for {stamp.verifiedGameVersion!.name} on {verifiedDate}
            </p>
            <p className="verification-status-note">
              This gameplay information was checked against this build.
            </p>
          </>
        ) : (
          <>
            <p className="verification-status-heading">Not verified for the current build</p>
            <p className="verification-status-note">
              This gameplay data may be outdated.
            </p>
          </>
        )}
      </div>
    </div>
  );
}
