// Component tests for the shared ConfirmDialog (Opus Pass 2), rendered to
// static HTML with react-dom/server — the established Node-only approach.
// Static render proves the dialog SEMANTICS (role, modal, labelled/described
// relationships, button labels and tone, and that a closed dialog renders
// nothing). The INTERACTIVE behavior (initial focus on the safe action,
// Escape/backdrop cancel, focus trap, focus return) runs only in a browser
// and is covered by e2e/admin-item-unsaved-changes.spec.ts.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ConfirmDialog } from "@/components/admin/confirm-dialog";

function render(overrides: Partial<Parameters<typeof ConfirmDialog>[0]> = {}) {
  return renderToStaticMarkup(
    <ConfirmDialog
      open
      title="Discard unsaved changes?"
      description="You have changes that haven’t been saved."
      confirmLabel="Discard changes"
      cancelLabel="Keep editing"
      onConfirm={() => {}}
      onCancel={() => {}}
      {...overrides}
    />
  );
}

describe("ConfirmDialog: closed state", () => {
  it("renders nothing when open is false", () => {
    const html = renderToStaticMarkup(
      <ConfirmDialog
        open={false}
        title="t"
        description="d"
        confirmLabel="c"
        cancelLabel="k"
        onConfirm={() => {}}
        onCancel={() => {}}
      />
    );
    expect(html).toBe("");
  });
});

describe("ConfirmDialog: dialog semantics", () => {
  it("renders a modal dialog", () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
  });

  it("labels the dialog by its title and describes it by its message", () => {
    const html = render();
    const labelledBy = html.match(/aria-labelledby="([^"]+)"/);
    const describedBy = html.match(/aria-describedby="([^"]+)"/);
    expect(labelledBy).not.toBeNull();
    expect(describedBy).not.toBeNull();
    // The referenced ids exist on the title and message elements.
    expect(html).toContain(`id="${labelledBy![1]}"`);
    expect(html).toContain(`id="${describedBy![1]}"`);
  });

  it("shows the title and description text", () => {
    const html = render();
    expect(html).toContain("Discard unsaved changes?");
    expect(html).toContain("You have changes that haven’t been saved.");
  });
});

describe("ConfirmDialog: actions", () => {
  it("renders both action buttons with their labels", () => {
    const html = render();
    expect(html).toContain("Keep editing");
    expect(html).toContain("Discard changes");
    // Both are real buttons (not divs).
    expect(html.match(/<button/g)?.length).toBe(2);
  });

  it("styles the confirm action as destructive by default", () => {
    const html = render();
    expect(html).toContain("btn-danger-outline");
  });

  it("styles the confirm action as primary (non-destructive) when confirmTone is primary", () => {
    const html = render({
      confirmTone: "primary",
      confirmLabel: "Restore draft",
      cancelLabel: "Discard draft",
    });
    expect(html).toContain("btn-primary");
    expect(html).not.toContain("btn-danger-outline");
  });

  it("keeps left-to-right DOM order cancel-then-confirm, so visual, keyboard, and screen-reader order agree", () => {
    // The recovery prompt renders "Discard draft" (cancel slot) before
    // "Restore draft" (confirm slot) in the DOM — matching the visual
    // left-to-right layout and the Tab order.
    const html = render({
      confirmTone: "primary",
      confirmLabel: "Restore draft",
      cancelLabel: "Discard draft",
    });
    expect(html.indexOf("Discard draft")).toBeLessThan(
      html.indexOf("Restore draft")
    );
  });
});
