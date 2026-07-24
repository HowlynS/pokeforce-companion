// Structural component tests for SearchableAdminSelect, rendered to static
// HTML with react-dom/server — the established Node-only approach (see
// admin-select.test.tsx's own docstring). A static render proves what's
// determined at render time: closed-state markup (the search panel is
// gated on `open`, which starts false, so it never appears in SSR output —
// exactly like AdminSelect's own listbox), the submitted proxy field, and
// icon/no-icon option rendering. Genuinely interactive behavior — opening,
// live filtering, keyboard navigation over filtered results, Tab
// continuation, and row isolation — needs a real DOM and is covered by
// e2e/admin-recipe-ingredient-search.spec.ts instead.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SearchableAdminSelect } from "@/components/admin/searchable-admin-select";
import type { AdminSelectOption } from "@/components/admin/admin-select";

const OPTIONS: AdminSelectOption[] = [
  { value: "iron-ore", label: "Iron Ore", imageUrl: "https://example.com/iron-ore.png" },
  { value: "copper-ore", label: "Copper Ore", imageUrl: null },
];

function render(overrides: Partial<React.ComponentProps<typeof SearchableAdminSelect>> = {}) {
  return renderToStaticMarkup(
    <SearchableAdminSelect name="ingredientItemId1" options={OPTIONS} {...overrides} />
  );
}

describe("SearchableAdminSelect: closed-state rendering", () => {
  it("renders exactly one trigger button with role=combobox and no open panel", () => {
    const html = render();

    expect(html.match(/<button/g)).toHaveLength(1);
    expect(html).toContain('role="combobox"');
    expect(html).toContain('aria-expanded="false"');
    // The search field and listbox are gated on `open` (false at first
    // render), so neither appears in a closed-state static render.
    expect(html).not.toContain("searchable-admin-select-search-input");
    expect(html).not.toContain('role="listbox"');
  });

  it("shows the placeholder when there is no selected value", () => {
    const html = render({ placeholder: "No ingredient" });
    expect(html).toContain('class="admin-select-placeholder"');
    expect(html).toContain(">No ingredient<");
  });

  it("shows the selected option's label and icon in the closed trigger", () => {
    const html = render({ defaultValue: "iron-ore" });
    expect(html).toContain(">Iron Ore<");
    expect(html).toContain("resource-icon");
    expect(html).toContain('src="https://example.com/iron-ore.png"');
  });

  it("renders the fallback icon slot for a selected option with no image", () => {
    const html = render({ defaultValue: "copper-ore" });
    expect(html).toContain("resource-icon-empty");
  });
});

describe("SearchableAdminSelect: the submitted proxy field", () => {
  it("carries the exact field name and current value, excluded from the tab order", () => {
    const html = render({ defaultValue: "iron-ore" });
    expect(html).toMatch(/<input[^>]*name="ingredientItemId1"[^>]*value="iron-ore"/);
    expect(html).toContain('tabindex="-1"');
  });

  it("is never type=\"hidden\", readonly, or disabled", () => {
    const html = render({ required: true });
    expect(html).not.toMatch(/type="hidden"/);
    expect(html).not.toContain("readonly");
  });

  it("associates with an external form via the form attribute when formId is supplied", () => {
    const html = render({ formId: "recipe-ingredients-form" });
    expect(html).toMatch(/<input[^>]*form="recipe-ingredients-form"/);
  });
});

describe("SearchableAdminSelect: disabled state", () => {
  it("disables the trigger button and never the proxy field itself", () => {
    const html = render({ disabled: true });
    expect(html).toMatch(/<button[^>]*disabled=""/);
    expect(html).not.toMatch(/<input[^>]*disabled/);
  });
});

describe("SearchableAdminSelect: multiple independent instances", () => {
  it("two rows never collide on submitted field name", () => {
    const html = renderToStaticMarkup(
      <>
        <SearchableAdminSelect name="ingredientItemId1" options={OPTIONS} defaultValue="iron-ore" />
        <SearchableAdminSelect name="ingredientItemId2" options={OPTIONS} defaultValue="" />
      </>
    );
    expect(html).toContain('name="ingredientItemId1"');
    expect(html).toContain('name="ingredientItemId2"');
  });
});
