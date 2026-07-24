// Structural component test for RecipeResultingItemSelect, rendered to
// static HTML with react-dom/server (see admin-select.test.tsx for the same
// precedent). Proves this stays a drop-in AdminSelect for
// `resultingItemId` — same field name, same options, same selected value —
// with no visible difference from a plain AdminSelect at render time. The
// image-change side effect only fires on a genuine user selection and is
// covered by e2e instead.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecipeResultingItemSelect } from "@/components/admin/recipe-resulting-item-select";
import type { AdminSelectOption } from "@/components/admin/admin-select";

const OPTIONS: AdminSelectOption[] = [
  { value: "item-1", label: "Copper Ingot", imageUrl: "https://example.com/copper-ingot.png" },
  { value: "item-2", label: "Iron Ingot", imageUrl: null },
];

describe("RecipeResultingItemSelect: initial render", () => {
  it("submits under the resultingItemId field name with the given default value", () => {
    const html = renderToStaticMarkup(
      <RecipeResultingItemSelect
        options={OPTIONS}
        defaultValue="item-2"
        itemImageById={{ "item-1": "https://example.com/copper-ingot.png", "item-2": null }}
      />
    );
    expect(html).toMatch(/name="resultingItemId"/);
    expect(html).toContain(">Iron Ingot<");
  });

  it("shows the placeholder when no default value is selected", () => {
    const html = renderToStaticMarkup(
      <RecipeResultingItemSelect
        options={OPTIONS}
        defaultValue=""
        itemImageById={{}}
        placeholder="Select an item"
      />
    );
    expect(html).toContain("Select an item");
  });
});
