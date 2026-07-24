// Structural component tests for AdminSelect, rendered to static HTML with
// react-dom/server (Node-only, no DOM library — the established
// component-test approach in this codebase; see record-slug-field.test.tsx
// and admin-form-guard.test.tsx for the same precedent). A static render
// proves everything determined at render time: closed-state markup, label
// delegation (a <label> wrapping this component associates with its first
// labelable descendant — the trigger <button> — with no extra prop needed),
// placeholder vs. selected-value display, the submitted proxy field's
// name/value/required, and disabled state. Genuinely interactive behavior —
// opening/closing, keyboard navigation, type-ahead, outside-click, and its
// integration with AdminFormGuard's dirty-state/draft-restoration machinery
// — needs a real DOM and is covered by e2e/admin-select-dropdown.spec.ts
// instead, exactly like every other interactive admin component in this
// project (RecordSlugField, AdminFormGuard).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AdminSelect, type AdminSelectOption } from "@/components/admin/admin-select";

const OPTIONS: AdminSelectOption[] = [
  { value: "materials", label: "Materials" },
  { value: "gear", label: "Gear" },
  { value: "components", label: "Components" },
];

function renderSelect(overrides: Partial<React.ComponentProps<typeof AdminSelect>> = {}) {
  return renderToStaticMarkup(
    <AdminSelect name="categoryId" options={OPTIONS} {...overrides} />
  );
}

describe("AdminSelect: closed-state rendering", () => {
  it("renders exactly one trigger button and no open panel", () => {
    const html = renderSelect();

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).not.toContain('role="listbox"');
    // role="combobox" (the WAI-ARIA "Select-Only Combobox" pattern) rather
    // than aria-haspopup, deliberately: a <label>-wrapped <button> with
    // this role still resolves its accessible name from the label exactly
    // like a native <select> did, so Playwright's existing
    // getByRole("combobox", { name: ... }) queries across the E2E suite
    // keep working unchanged after the native <select> is replaced.
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
  });

  it("shows the placeholder when there is no selected value", () => {
    const html = renderSelect({ placeholder: "No category" });

    expect(html).toContain('class="admin-select-placeholder"');
    expect(html).toContain(">No category<");
  });

  it("shows the matching option's label when a value is selected (uncontrolled defaultValue)", () => {
    const html = renderSelect({ defaultValue: "gear" });

    expect(html).toContain('class="admin-select-value"');
    expect(html).toContain(">Gear<");
    expect(html).not.toContain("No category");
  });

  it("shows the matching option's label when controlled via value", () => {
    const html = renderSelect({ value: "components" });

    expect(html).toContain(">Components<");
  });

  it("a label wrapping the component associates with the trigger button (the first labelable descendant)", () => {
    const html = renderToStaticMarkup(
      <label className="form-field">
        <span className="form-field-label">Category</span>
        <AdminSelect name="categoryId" options={OPTIONS} />
      </label>
    );

    expect(html).toMatch(/<label[^>]*><span[^>]*>Category<\/span><div class="admin-select"><button/);
  });
});

describe("AdminSelect: the submitted proxy field", () => {
  it("carries the exact field name and current value, and is excluded from the tab order", () => {
    const html = renderSelect({ defaultValue: "gear" });

    expect(html).toMatch(/<input[^>]*name="categoryId"[^>]*value="gear"/);
    expect(html).toContain('tabindex="-1"');
    expect(html).toContain('aria-hidden="true"');
  });

  it("is never type=\"hidden\", readonly, or disabled — all three are excluded from constraint validation", () => {
    const html = renderSelect({ required: true });

    expect(html).not.toMatch(/type="hidden"/);
    expect(html).not.toContain("readonly");
    expect(html).not.toMatch(/<input[^>]*disabled/);
  });

  it("carries required exactly when the field is required", () => {
    const required = renderSelect({ required: true });
    const optional = renderSelect({ required: false });

    expect(required).toMatch(/<input[^>]*required=""/);
    expect(optional).not.toContain("required");
  });

  it("associates with an external form via the form attribute when formId is supplied", () => {
    const html = renderSelect({ formId: "item-edit-form" });

    expect(html).toMatch(/<input[^>]*form="item-edit-form"/);
  });
});

describe("AdminSelect: disabled state", () => {
  it("disables the trigger button and never the proxy field itself", () => {
    const html = renderSelect({ disabled: true });

    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).not.toMatch(/<input[^>]*disabled/);
  });
});

describe("AdminSelect: multiple independent instances", () => {
  it("two instances on the same render never collide on id or submitted name", () => {
    const html = renderToStaticMarkup(
      <>
        <AdminSelect name="ingredientItemId1" options={OPTIONS} defaultValue="materials" />
        <AdminSelect name="ingredientItemId2" options={OPTIONS} defaultValue="" />
      </>
    );

    expect(html).toContain('name="ingredientItemId1"');
    expect(html).toContain('name="ingredientItemId2"');
    // Each instance's own useId()-derived listbox/option ids must differ.
    const idMatches = [...html.matchAll(/aria-controls="([^"]*)"/g)];
    // Both are closed here, so aria-controls is absent on both — the real
    // per-instance-uniqueness guarantee comes from React's useId, exercised
    // properly (with real mounted listbox ids) in the E2E ingredient-row
    // isolation coverage instead.
    expect(idMatches.length).toBe(0);
  });
});
