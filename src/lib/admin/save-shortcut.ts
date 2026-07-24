// OS-aware save-shortcut label (Admin Polish Pass 2, Part 4). Pure string
// logic only — reading the actual platform is the caller's job (client-
// side, via navigator), kept out of this file so it stays trivially unit-
// testable without a DOM/navigator environment. The default ("Ctrl+S") is
// also the safe pre-detection value every render must start from, so
// there is no server/client hydration mismatch.
export function isMacPlatform(platform: string | null | undefined): boolean {
  if (!platform) {
    return false;
  }
  // Covers "MacIntel"/"Mac68K"/"macOS" (navigator.platform / userAgentData)
  // and the mobile Apple identifiers new for completeness even though this
  // admin surface is desktop-first — never false-matches "Windows" or a
  // generic "Linux x86_64" string.
  return /mac|iphone|ipad|ipod/i.test(platform);
}

export function formatSaveShortcutLabel(
  platform: string | null | undefined
): string {
  return isMacPlatform(platform) ? "⌘S" : "Ctrl+S";
}

export function saveShortcutAccessibleLabel(
  platform: string | null | undefined
): string {
  return isMacPlatform(platform)
    ? "Save shortcut: Command S"
    : "Save shortcut: Control S";
}
