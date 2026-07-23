// Structural component tests for AdminFormGuard's actions row, rendered to
// static HTML with react-dom/server (Node-only, no DOM library — the
// established component-test approach; see record-slug-field.test.tsx's own
// docstring for why this project tests interactive behavior via E2E rather
// than a DOM-mounting library). useFormStatus reads its pending/context from
// the ancestor <form> during render itself (no effect needed), so a plain
// static render inside a real <form> is enough to prove the markup this
// pass changed: which CSS class the root actions div carries for each
// `layout`, and the row's own structure (Cancel, Save, status). Dirty-state
// transitions, drafts, navigation, and Ctrl/Cmd+S all depend on the mount
// effect (which never runs in a static render) and stay E2E-only, exactly
// like every other guard behavior.
//
// next/navigation's useRouter is mocked (same pattern as admin-nav.test.tsx)
// since AdminFormGuard calls it unconditionally, even though a static render
// never exercises the navigation it powers.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

import { AdminFormGuard } from "@/components/admin/admin-form-guard";

function renderGuard(
  overrides: Partial<React.ComponentProps<typeof AdminFormGuard>> = {}
) {
  return renderToStaticMarkup(
    <form action={async () => {}}>
      <AdminFormGuard
        submitLabel="Save Changes"
        cancelHref="/admin/things"
        {...overrides}
      />
    </form>
  );
}

describe("AdminFormGuard: layout prop controls the actions-row surface treatment", () => {
  it("defaults to the sticky, surfaced actions row when layout is omitted", () => {
    const html = renderGuard();

    expect(html).toMatch(/<div class="admin-editor-actions"/);
    expect(html).not.toContain("admin-editor-actions--inline");
  });

  it("layout=\"surface\" renders identically to the default (explicit opt-in to the same surface)", () => {
    const html = renderGuard({ layout: "surface" });

    expect(html).toMatch(/<div class="admin-editor-actions"/);
    expect(html).not.toContain("admin-editor-actions--inline");
  });

  it("layout=\"inline\" adds the inline modifier class alongside the base class — never replacing it", () => {
    const html = renderGuard({ layout: "inline" });

    expect(html).toMatch(
      /<div class="admin-editor-actions admin-editor-actions--inline"/
    );
  });
});

describe("AdminFormGuard: actions-row structure is unchanged by layout", () => {
  it("renders Cancel and the primary submit action in both layouts", () => {
    for (const layout of ["surface", "inline"] as const) {
      const html = renderGuard({ layout, submitLabel: "Create Game Version" });

      expect(html).toContain(">Cancel<");
      expect(html).toContain("Create Game Version");
      expect(html).toMatch(/<button type="submit"[^>]*class="btn btn-primary/);
    }
  });

  it("the status element follows Cancel and Save in DOM order, in both layouts", () => {
    for (const layout of ["surface", "inline"] as const) {
      const html = renderGuard({ layout });

      const cancelIndex = html.indexOf(">Cancel<");
      const submitIndex = html.indexOf('<button type="submit"');
      const statusIndex = html.indexOf('class="admin-form-status"');
      expect(cancelIndex).toBeGreaterThan(-1);
      expect(submitIndex).toBeGreaterThan(cancelIndex);
      expect(statusIndex).toBeGreaterThan(submitIndex);
    }
  });

  it("the status element carries aria-live but never role=\"status\" (would collide with a page's own success/error banner)", () => {
    const html = renderGuard();

    expect(html).toContain('aria-live="polite"');
    expect(html).not.toMatch(/admin-form-status[^>]*role="status"/);
    expect(html).not.toContain('role="status"');
  });

  it("a clean render (no dirty state reachable statically) shows no status text and empty status class", () => {
    const html = renderGuard();

    expect(html).toMatch(/<span class="admin-form-status" aria-live="polite"><\/span>/);
  });
});
