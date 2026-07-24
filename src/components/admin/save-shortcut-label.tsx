"use client";

// OS-aware save-shortcut badge (Admin Polish Pass 2, Part 4; moved inside
// the Save button by the Admin UI Corrections pass) — rendered once as the
// LAST child of AdminFormGuard's own submit button, so it appears
// consistently on every guarded admin form without any other component
// needing its own platform-detection logic. Server-side user-agent
// sniffing is deliberately not used (a client-only concern, and this
// repo's Server Components have no reliable per-request "requesting OS"
// signal worth plumbing through just for this); instead the safe,
// hydration-matching default ("Ctrl+S") renders on both the server and the
// client's first paint, and a mount-only effect upgrades it to the Mac
// label when `navigator` actually reports one — never a different value on
// the two initial renders, so no hydration mismatch warning is possible.
//
// aria-hidden (Admin UI Corrections pass): now that this renders INSIDE
// the button, an aria-label here would concatenate into the button's own
// accessible name via the browser's name-from-content algorithm, turning
// "Save Changes" into something like "Save Changes, Save shortcut: Control
// S" — redundant, and the physical Ctrl+S/Cmd+S shortcut still works
// either way (see admin-save-shortcut-label.spec.ts). Marking this span
// aria-hidden keeps the button's accessible name exactly "Save Changes" /
// "Saving…", and the badge is not independently focusable (a plain
// non-interactive <span>), so it can never become a second focus target
// either. saveShortcutAccessibleLabel remains exported and unit-tested for
// any future caller that DOES want the spelled-out label announced.
import { useEffect, useState } from "react";
import { formatSaveShortcutLabel } from "@/lib/admin/save-shortcut";

type NavigatorWithUAData = Navigator & {
  userAgentData?: { platform?: string };
};

export function SaveShortcutLabel() {
  const [platform, setPlatform] = useState<string | null>(null);

  useEffect(() => {
    const nav = navigator as NavigatorWithUAData;
    // Deliberate: navigator is unavailable during SSR, so the safe
    // "Ctrl+S" default must render on both the server and the client's
    // first paint (no hydration mismatch), and only upgrade to the real
    // platform's label once mounted. There is no way to read this signal
    // during render itself.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setPlatform(nav.userAgentData?.platform ?? nav.platform ?? null);
  }, []);

  return (
    <span className="admin-editor-shortcut-hint" aria-hidden="true">
      {formatSaveShortcutLabel(platform)}
    </span>
  );
}
