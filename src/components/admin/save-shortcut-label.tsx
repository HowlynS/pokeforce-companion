"use client";

// OS-aware save-shortcut hint (Admin Polish Pass 2, Part 4) — rendered
// once inside AdminFormGuard's own actions row, so it appears consistently
// on every guarded admin form without any other component needing its own
// platform-detection logic. Server-side user-agent sniffing is
// deliberately not used (a client-only concern, and this repo's Server
// Components have no reliable per-request "requesting OS" signal worth
// plumbing through just for this); instead the safe, hydration-matching
// default ("Ctrl+S") renders on both the server and the client's first
// paint, and a mount-only effect upgrades it to the Mac label when
// `navigator` actually reports one — never a different value on the two
// initial renders, so no hydration mismatch warning is possible.
import { useEffect, useState } from "react";
import {
  formatSaveShortcutLabel,
  saveShortcutAccessibleLabel,
} from "@/lib/admin/save-shortcut";

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
    <span
      className="admin-editor-shortcut-hint"
      aria-label={saveShortcutAccessibleLabel(platform)}
    >
      {formatSaveShortcutLabel(platform)}
    </span>
  );
}
