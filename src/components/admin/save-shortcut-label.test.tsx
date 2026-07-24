// Component test for SaveShortcutLabel (Admin Polish Pass 2, Part 4),
// rendered to static HTML with react-dom/server — the established
// Node-only approach for this codebase's presentational components.
// renderToStaticMarkup never runs effects, so this exercises exactly the
// safe, pre-detection default render every real page load also starts
// from (before the mount-only navigator check can run) — the Mac-
// detected render itself is proven separately at the pure-function level
// in save-shortcut.test.ts, since this test environment has no DOM/
// navigator to emulate a platform with.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SaveShortcutLabel } from "@/components/admin/save-shortcut-label";

describe("SaveShortcutLabel: safe default render", () => {
  it("renders the Ctrl+S label before any client-side platform detection", () => {
    const html = renderToStaticMarkup(<SaveShortcutLabel />);
    expect(html).toContain("Ctrl+S");
    expect(html).not.toContain("⌘S");
  });

  it("exposes a spelled-out accessible label, never relying solely on the glyph", () => {
    const html = renderToStaticMarkup(<SaveShortcutLabel />);
    expect(html).toContain('aria-label="Save shortcut: Control S"');
  });

  it("renders inside the shared hint class", () => {
    const html = renderToStaticMarkup(<SaveShortcutLabel />);
    expect(html).toContain("admin-editor-shortcut-hint");
  });
});
