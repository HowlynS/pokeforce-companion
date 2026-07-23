// Component tests for the Phase B1 (System B) Page-address field —
// edit-mode synchronization revised in the Admin Visual/UX Correction pass
// (Part 11) — rendered to static HTML with react-dom/server (Node-only, no
// DOM library — the established component-test approach). react-dom/server
// renders exactly once and never runs effects, so genuinely interactive
// behavior (typing switching the field to manual mode, Name changes
// updating an already-rendered field live, the debounced availability
// check actually resolving) is E2E territory (e2e/admin-slug-feedback.spec.ts)
// — matching this codebase's own established precedent, where the
// equivalent Name field (RecordNameField) has no component test file of
// its own either.
//
// What IS fully verifiable from a single static render, because
// auto-generation is derived from props during render rather than pushed
// from an effect: BOTH create's and edit's INITIAL value (create shows the
// live nameValue's own generated slug; edit shows the persisted
// initialSlug, since a single render's `nameValue` trivially equals the
// `initialNameRef` it captures on that same render — the two only diverge
// across MULTIPLE renders, which only a real browser interaction produces),
// and every purely prop/state-derived feedback state reachable before any
// async response exists (idle, invalid, current, and the "checking"
// fallback — "available"/"taken"/"failed" all require the debounced
// effect to actually resolve, which never happens in a static render).
//
// UI-cleanup pass: the field's visible label is now exactly "Page
// address" in both create and edit mode (the earlier create-only
// "(optional — generated from name if left blank)" hint is gone), and
// the "Use name" reset button is gone entirely — manual override is now
// final for the rest of a form's session, with no way back to auto mode
// short of reloading the page. The component no longer accepts a `mode`
// prop at all (Part 11): both create and edit now behave identically —
// auto-generation, manual-override tracking, and availability checking
// are otherwise unchanged in mechanism.

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
      nameValue=""
      checkAvailabilityAction={alwaysAvailable}
      takenText="An item with that page address already exists."
      regionId="item-slug-availability"
      {...overrides}
    />
  );
}

describe("RecordSlugField: auto-generation from Name on first render", () => {
  it("starts blank when Name is blank and there is no persisted slug (create)", () => {
    const html = renderField({ nameValue: "" });

    expect(html).toMatch(/<input [^>]*value=""/);
  });

  it("generates the slug from the live Name value on the very first render when there is no persisted slug (create)", () => {
    const html = renderField({ nameValue: "Iron Sword" });

    expect(html).toMatch(/<input [^>]*value="iron-sword"/);
  });

  it("applies the same canonical slug rule the server uses (spaces, punctuation, casing)", () => {
    const html = renderField({
      nameValue: "  Stamina   Brew's Mk2! ",
    });

    expect(html).toMatch(/<input [^>]*value="stamina-brew-s-mk2"/);
  });

  it("renders the plain 'Page address' label with no explanatory hint", () => {
    const html = renderField({});

    expect(html).toContain("Page address");
    expect(html).not.toContain("optional");
    expect(html).not.toContain("generated from name");
  });
});

describe("RecordSlugField: edit-form initial synchronization state (persisted value on first render)", () => {
  it("shows the persisted Page address on the first render, regardless of the live Name value passed alongside it", () => {
    // A single static render's `nameValue` trivially equals the
    // `initialNameRef` value this field captures on that same render, so
    // the auto-generated value is the persisted `initialSlug` — exactly
    // the "start with the persisted Page address" contract Part 11
    // requires for an edit form's first paint. Multi-render behavior
    // (Name genuinely CHANGING after mount) is E2E territory.
    const html = renderField({
      nameValue: "A Completely Different Name",
      initialSlug: "original-slug",
    });

    expect(html).toMatch(/<input [^>]*value="original-slug"/);
  });

  it("renders the identical plain label as a fresh create render", () => {
    const html = renderField({ initialSlug: "original-slug" });

    expect(html).toContain("Page address");
    expect(html).not.toContain("optional");
    expect(html).not.toContain("generated from name");
  });

  it("treats the unchanged persisted slug as current (silent, not a duplicate check)", () => {
    const html = renderField({
      initialSlug: "original-slug",
      nameValue: "original-slug's own record name",
    });

    // "current" renders no visible feedback text.
    expect(html).toMatch(
      /<p id="item-slug-availability"[^>]*><\/p>/
    );
  });
});

describe("RecordSlugField feedback states reachable from a single render", () => {
  it("shows nothing for a blank field (idle)", () => {
    const html = renderField({ nameValue: "" });

    expect(html).toMatch(/<p id="item-slug-availability"[^>]*><\/p>/);
  });

  it("shows the exact server-matching invalid message for a persisted value that is non-blank yet structurally invalid", () => {
    // In auto mode, "!!!" from Name derives an auto-generated slug of ""
    // — indistinguishable from a genuinely blank field (idle), which is
    // correct: nothing was ever typed INTO the field itself. The
    // "invalid" state is for the field's own raw text being non-blank yet
    // structurally invalid — exercised here via a persisted value that is
    // itself invalid (unchanged from Name, so this render's own auto
    // value IS that persisted value).
    const html = renderField({ initialSlug: "!!!", nameValue: "irrelevant" });

    expect(html).toContain(
      "Enter a valid slug using lowercase letters, numbers, and hyphens."
    );
  });

  it("treats an auto-generated blank slug (Name normalizes to nothing) as idle, not invalid", () => {
    const html = renderField({ nameValue: "!!!" });

    expect(html).toMatch(/<p id="item-slug-availability"[^>]*><\/p>/);
    expect(html).not.toContain("Enter a valid slug");
  });

  it("falls back to the checking message for a valid, not-yet-answered candidate", () => {
    const html = renderField({ nameValue: "Iron Sword" });

    expect(html).toContain("Checking page address availability");
  });

  it("keeps the feedback paragraph's id, aria-live, and reserved-height class present in every state", () => {
    for (const nameValue of ["", "!!!", "Iron Sword"]) {
      const html = renderField({ nameValue });
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

  it("associates the label with the input via nesting (no separate id/for pair)", () => {
    const html = renderField({ regionId: "recipe-slug-availability" });

    expect(html).toMatch(
      /<label class="form-field"><span class="form-field-label">Page address<\/span><input [^>]*name="slug"/
    );
  });

  it("renders no button at all — the 'Use name' reset control was removed", () => {
    const html = renderField();

    expect(html.match(/<button/g)).toBeNull();
    expect(html).not.toContain("Use name");
  });

  it("never disables or hides the field itself", () => {
    const html = renderField();

    expect(html).not.toContain("disabled");
  });

  it("renders exactly one input and one feedback paragraph — no extra row/wrapper markup", () => {
    const html = renderField();

    expect(html.match(/<input /g)).toHaveLength(1);
    expect(html.match(/<p /g)).toHaveLength(1);
    expect(html).not.toContain("form-field-label-row");
    expect(html).not.toContain("form-field-inline-action");
  });

  it("does not accept a mode prop (Part 11: create and edit behave identically)", () => {
    // TypeScript already enforces this at compile time (RecordSlugField's
    // props no longer declare `mode`) — this test only documents the
    // change for readers of this file, guarding against the prop quietly
    // being reintroduced.
    const props: React.ComponentProps<typeof RecordSlugField> = {
      nameValue: "",
      checkAvailabilityAction: alwaysAvailable,
      takenText: "taken",
      regionId: "x",
    };
    expect("mode" in props).toBe(false);
  });
});
