// Component tests for the shared DeleteRecordDialog (Massive Admin
// Interaction Completion Pass, Phase 2), rendered to static HTML with
// react-dom/server — the established Node-only approach. Static render
// proves the dialog reuses ConfirmDialog's modal semantics, renders the
// caller's resource-fact children, carries the exact hidden fields the old
// per-resource forms used, and disables (never hides) Confirm while
// canDelete is false. Interactive behavior (Confirm triggering the real
// form's requestSubmit, Cancel/Escape/backdrop navigation) is E2E-only,
// covered by e2e/admin-delete-dialog.spec.ts.

import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";

// Same pattern as admin-form-guard.test.tsx: DeleteRecordDialog calls
// useRouter unconditionally (for Cancel/Escape/backdrop navigation), even
// though a static render never exercises it.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: () => {} }),
}));

import { DeleteRecordDialog } from "@/components/admin/delete-record-dialog";

function render(overrides: Partial<Parameters<typeof DeleteRecordDialog>[0]> = {}) {
  const {
    children = <p className="text-muted">Category: Materials</p>,
    ...rest
  } = overrides;
  return renderToStaticMarkup(
    <DeleteRecordDialog
      title="Delete Item"
      description={
        <>
          You are about to permanently delete <strong>Iron Ore</strong>{" "}
          (iron-ore). This action cannot be undone.
        </>
      }
      canDelete
      formAction={() => {}}
      hiddenFields={{ id: "item-1", slug: "iron-ore" }}
      cancelHref="/admin/items/iron-ore/edit"
      {...rest}
    >
      {children}
    </DeleteRecordDialog>
  );
}

describe("DeleteRecordDialog: dialog semantics", () => {
  it("renders a modal dialog with the given title", () => {
    const html = render();
    expect(html).toContain('role="dialog"');
    expect(html).toContain('aria-modal="true"');
    expect(html).toContain("Delete Item");
  });

  it("renders the description and the caller's resource-fact children", () => {
    const html = render();
    expect(html).toContain("Iron Ore");
    expect(html).toContain("iron-ore");
    expect(html).toContain("Category: Materials");
  });
});

describe("DeleteRecordDialog: hidden form", () => {
  it("carries exactly the hidden fields the caller supplied", () => {
    const html = render({
      hiddenFields: { id: "src-1", itemSlug: "iron-ore" },
    });
    expect(html).toContain('name="id"');
    expect(html).toContain('value="src-1"');
    expect(html).toContain('name="itemSlug"');
    expect(html).toContain('value="iron-ore"');
  });

  it("renders a real <form>, not a fake mutation control", () => {
    const html = render();
    expect(html).toContain("<form");
  });
});

describe("DeleteRecordDialog: blocked deletion", () => {
  it("defaults to an enabled Delete Permanently action", () => {
    const html = render();
    expect(html).toContain("Delete Permanently");
    expect(html).not.toMatch(/Delete Permanently[\s\S]{0,60}disabled/);
  });

  it("uses the full-strength solid danger treatment (never the outline reserved for links that only lead to this page)", () => {
    const html = render();
    expect(html).toContain("btn-danger");
    expect(html).not.toContain("btn-danger-outline");
  });

  it("disables (never hides) the confirm action when canDelete is false", () => {
    const html = render({
      canDelete: false,
      children: (
        <p className="text-danger">
          This item cannot be deleted because it is used as a recipe result.
        </p>
      ),
    });
    expect(html).toContain("Delete Permanently");
    expect(html).toContain("disabled");
    expect(html).toContain(
      "This item cannot be deleted because it is used as a recipe result."
    );
  });

  it("supports a custom confirm label", () => {
    const html = render({ confirmLabel: "Delete Recipe Permanently" });
    expect(html).toContain("Delete Recipe Permanently");
  });
});

describe("DeleteRecordDialog: cancel action", () => {
  it("renders Cancel as a real, navigable link to cancelHref — not a JS-only button", () => {
    const html = render();
    expect(html).toContain("Cancel");
    expect(html).toContain('href="/admin/items/iron-ore/edit"');
    // Exactly one real <button> remains (Confirm) now that Cancel is a link.
    expect(html.match(/<button/g)?.length).toBe(1);
  });

  it("still shows the Destructive action eyebrow", () => {
    const html = render();
    expect(html).toContain("Destructive action");
  });
});
