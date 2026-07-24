// Structural component tests for GameVersionDeleteAction (Admin Polish
// Pass 1, Part 5), rendered to static HTML with react-dom/server — the
// established Node-only approach. A static render proves the closed-state
// shape (its own dialog-open state starts false, so no dialog markup
// appears yet); the dialog opening, the optimistic canDelete/fallback-
// route behavior, and Ctrl+S suppression are interactive behavior covered
// by e2e/admin-in-editor-delete.spec.ts instead.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Same pattern as admin-form-guard.test.tsx / delete-record-dialog.test.tsx:
// DeleteRecordDialog (rendered only once open) calls useRouter
// unconditionally, even though a closed-state static render never reaches it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

import { GameVersionDeleteAction } from "@/components/admin/game-version-delete-action";

function render(overrides: Partial<React.ComponentProps<typeof GameVersionDeleteAction>> = {}) {
  return renderToStaticMarkup(
    <GameVersionDeleteAction
      id="gv-1"
      name="Summer Update"
      isCurrent={false}
      releaseDateLabel="14 Jul 2026"
      formAction={() => {}}
      {...overrides}
    />
  );
}

describe("GameVersionDeleteAction: closed-state rendering", () => {
  it("renders a compact destructive trigger button with no dialog markup yet", () => {
    const html = render();

    expect(html).toMatch(/<button[^>]*>\s*Delete\s*<\/button>/);
    expect(html).toContain("btn-danger-outline");
    expect(html).toContain("btn-compact");
    expect(html).not.toContain('role="dialog"');
    expect(html).not.toContain("<form");
  });

  it("renders exactly one button in its closed state", () => {
    const html = render();
    expect(html.match(/<button/g)).toHaveLength(1);
  });
});
