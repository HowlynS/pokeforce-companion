// Component tests for the Phase B1 (System B) Page-address field,
// rendered to static HTML with react-dom/server (Node-only, no DOM
// library — the established component-test approach). react-dom/server
// renders exactly once and never runs effects, so genuinely interactive
// behavior (typing switching the field to manual mode, the debounced
// availability check actually resolving, the "Use name" click) is E2E
// territory — matching this codebase's own established precedent, where
// the equivalent Name field (RecordNameField) has no component test file
// of its own either, only full E2E coverage (admin-name-feedback.spec.ts
// / admin-item-name-feedback.spec.ts).
//
// What IS fully verifiable from a single static render, because auto-
// generation is derived from props during render rather than pushed from
// an effect: create mode's INITIAL value already tracks the given
// nameValue prop, edit mode's INITIAL value ignores nameValue entirely,
// and every purely prop/state-derived feedback state reachable before any
// async response exists (idle, invalid, current, and the "checking"
// fallback — "available"/"taken"/"failed" all require the debounced
// effect to actually resolve, which never happens in a static render).

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { RecordSlugField } from "@/components/admin/record-slug-field";

async function alwaysAvailable() {
  return "available" as const;
}

function renderField(
  overrides: Partial<React.ComponentProps<typeof RecordSlugField>> = {}
) {
  return renderToStaticMarkup(
    <RecordSlugField
      mode="create"
      nameValue=""
      checkAvailabilityAction={alwaysAvailable}
      takenText="An item with that page address already exists."
      regionId="item-slug-availability"
      {...overrides}
    />
  );
}

describe("RecordSlugField create mode: auto-generation from Name", () => {
  it("starts blank when Name is blank", () => {
    const html = renderField({ mode: "create", nameValue: "" });

    expect(html).toMatch(/<input [^>]*value=""/);
  });

  it("generates the slug from the live Name value on the very first render", () => {
    const html = renderField({ mode: "create", nameValue: "Iron Sword" });

    expect(html).toMatch(/<input [^>]*value="iron-sword"/);
  });

  it("applies the same canonical slug rule the server uses (spaces, punctuation, casing)", () => {
    const html = renderField({
      mode: "create",
      nameValue: "  Stamina   Brew's Mk2! ",
    });

    expect(html).toMatch(/<input [^>]*value="stamina-brew-s-mk2"/);
  });

  it("renders the create-only helper hint in the label", () => {
    const html = renderField({ mode: "create" });

    expect(html).toContain(
      "Page address (optional — generated from name if left blank)"
    );
  });
});

describe("RecordSlugField edit mode: manually controlled from the start", () => {
  it("populates the persisted Page address regardless of the live Name value", () => {
    const html = renderField({
      mode: "edit",
      nameValue: "A Completely Different Name",
      initialSlug: "original-slug",
    });

    expect(html).toMatch(/<input [^>]*value="original-slug"/);
  });

  it("renders the plain label with no create-only hint", () => {
    const html = renderField({ mode: "edit", initialSlug: "original-slug" });

    expect(html).toContain("Page address");
    expect(html).not.toContain("generated from name");
  });

  it("treats the unchanged persisted slug as current (silent, not a duplicate check)", () => {
    const html = renderField({
      mode: "edit",
      initialSlug: "original-slug",
      nameValue: "irrelevant",
    });

    // "current" renders no visible feedback text.
    expect(html).toMatch(
      /<p id="item-slug-availability"[^>]*><\/p>/
    );
  });
});

describe("RecordSlugField feedback states reachable from a single render", () => {
  it("shows nothing for a blank field (idle)", () => {
    const html = renderField({ mode: "create", nameValue: "" });

    expect(html).toMatch(/<p id="item-slug-availability"[^>]*><\/p>/);
  });

  it("shows the exact server-matching invalid message for non-blank text that normalizes to nothing", () => {
    // In create/auto mode, "!!!" from Name derives an auto-generated slug
    // of "" — indistinguishable from a genuinely blank field (idle), which
    // is correct: nothing was ever typed INTO the field itself. The
    // "invalid" state is for the field's own raw text being non-blank yet
    // structurally invalid — exercised here via a manually-controlled
    // value (edit mode's own persisted value doubles as that raw text).
    const html = renderField({ mode: "edit", initialSlug: "!!!" });

    expect(html).toContain(
      "Enter a valid slug using lowercase letters, numbers, and hyphens."
    );
  });

  it("treats an auto-generated blank slug (Name normalizes to nothing) as idle, not invalid", () => {
    const html = renderField({ mode: "create", nameValue: "!!!" });

    expect(html).toMatch(/<p id="item-slug-availability"[^>]*><\/p>/);
    expect(html).not.toContain("Enter a valid slug");
  });

  it("falls back to the checking message for a valid, not-yet-answered candidate", () => {
    const html = renderField({ mode: "create", nameValue: "Iron Sword" });

    expect(html).toContain("Checking page address availability");
  });

  it("keeps the feedback paragraph's id, aria-live, and reserved-height class present in every state", () => {
    for (const nameValue of ["", "!!!", "Iron Sword"]) {
      const html = renderField({ mode: "create", nameValue });
      expect(html).toMatch(
        /<p id="item-slug-availability" aria-live="polite" class="form-field-feedback"/
      );
    }
  });
});

describe("RecordSlugField structure and accessibility", () => {
  it("submits as a plain name=\"slug\" field", () => {
    const html = renderField();

    expect(html).toMatch(/<input [^>]*name="slug"/);
  });

  it("associates the label with the input via a real id/for pair, not nesting", () => {
    const html = renderField({ regionId: "recipe-slug-availability" });

    expect(html).toMatch(/<label [^>]*for="recipe-slug-availability-input"/);
    expect(html).toMatch(/<input id="recipe-slug-availability-input"/);
  });

  it("renders exactly one real, keyboard-accessible 'Use name' button, never a link", () => {
    const html = renderField();

    expect(html).toMatch(/<button type="button"[^>]*>Use name<\/button>/);
    expect(html.match(/<button/g)).toHaveLength(1);
  });

  it("never disables or hides the field itself", () => {
    const html = renderField();

    expect(html).not.toContain("disabled");
  });
});
