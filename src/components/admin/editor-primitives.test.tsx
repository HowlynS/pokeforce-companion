// Component tests for the Slice 9B.2 shared editor primitives. Rendered
// to static HTML with react-dom/server — Node-only, no DOM library,
// matching the project's testing decision — and asserted on the markup:
// optional regions must be absent (not empty) when their props are not
// supplied, active/accessible state must be exposed via aria-current, and
// the verification panel must compose the real
// GameVersionVerificationControls rather than reimplementing it.

import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorTabs } from "@/components/admin/editor-tabs";
import { ContextPanel } from "@/components/admin/context-panel";
import { ImagePanel } from "@/components/admin/image-panel";
import { VerificationPanel } from "@/components/admin/verification-panel";
import { TimestampsPanel } from "@/components/admin/timestamps-panel";
import { EditorActions } from "@/components/admin/editor-actions";

describe("EditorHeader", () => {
  it("renders the title as the page's one h1", () => {
    const html = renderToStaticMarkup(<EditorHeader title="Iron Ore" />);

    expect(html).toContain("<h1");
    expect(html).toContain("Iron Ore");
  });

  it("omits every optional region when not supplied", () => {
    const html = renderToStaticMarkup(<EditorHeader title="Iron Ore" />);

    expect(html).not.toContain("admin-editor-header-back");
    expect(html).not.toContain("admin-editor-subtitle");
    expect(html).not.toContain("admin-editor-header-actions");
  });

  it("renders back link, subtitle, status, and actions when supplied", () => {
    const html = renderToStaticMarkup(
      <EditorHeader
        title="Iron Ore"
        subtitle="iron-ore"
        backHref="/admin/items"
        backLabel="Back to Items"
        status={<span className="admin-status-badge">Unverified</span>}
        actions={<button type="button">Duplicate</button>}
      />
    );

    expect(html).toContain('href="/admin/items"');
    expect(html).toContain("Back to Items");
    expect(html).toContain("iron-ore");
    expect(html).toContain("Unverified");
    expect(html).toContain("Duplicate");
  });
});

describe("EditorTabs", () => {
  const tabs = [
    { label: "Details", href: "/admin/items/iron-ore/edit", active: true },
    {
      label: "Sources",
      href: "/admin/items/iron-ore/sources",
      active: false,
    },
  ];

  it("marks exactly the active tab with aria-current", () => {
    const html = renderToStaticMarkup(
      <EditorTabs label="Item editor sections" tabs={tabs} />
    );

    expect(html.match(/aria-current="page"/g)).toHaveLength(1);
    // The one aria-current sits on the ACTIVE tab's anchor (attribute
    // order within the tag is serializer-defined, so match the tag).
    expect(html).toMatch(
      /<a [^>]*href="\/admin\/items\/iron-ore\/edit"[^>]*aria-current="page"[^>]*>/
    );
    expect(html).toContain('href="/admin/items/iron-ore/sources"');
  });

  it("labels the navigation landmark and renders tabs as links", () => {
    const html = renderToStaticMarkup(
      <EditorTabs label="Item editor sections" tabs={tabs} />
    );

    expect(html).toContain('aria-label="Item editor sections"');
    expect(html).toContain("<nav");
    expect(html.match(/<a /g)).toHaveLength(2);
  });

  it("supports query-state tab targets without special handling", () => {
    const html = renderToStaticMarkup(
      <EditorTabs
        label="Sections"
        tabs={[{ label: "Details", href: "?tab=details", active: true }]}
      />
    );

    expect(html).toContain('href="?tab=details"');
  });

  it("renders a disabled tab as inert text, never a link", () => {
    const html = renderToStaticMarkup(
      <EditorTabs
        label="Item editor sections"
        tabs={[
          { label: "General", href: "/admin/items/iron-ore/edit", active: true },
          { label: "Acquisition Sources", href: "", active: false, disabled: true },
        ]}
      />
    );

    expect(html).toContain('aria-disabled="true"');
    expect(html).toContain("Acquisition Sources");
    // Exactly one <a>, for the active/enabled tab — the disabled tab is a
    // <span>, never an anchor a reader could click into an empty page.
    expect(html.match(/<a /g)).toHaveLength(1);
    expect(html).toMatch(/<span[^>]*aria-disabled="true"[^>]*>Acquisition Sources<\/span>/);
  });
});

describe("ContextPanel", () => {
  it("renders the title as a heading with the content slot", () => {
    const html = renderToStaticMarkup(
      <ContextPanel title="Verification">
        <p>Body</p>
      </ContextPanel>
    );

    expect(html).toContain("<h2");
    expect(html).toContain("Verification");
    expect(html).toContain("Body");
  });

  it("omits description and footer when not supplied", () => {
    const html = renderToStaticMarkup(
      <ContextPanel title="Verification">
        <p>Body</p>
      </ContextPanel>
    );

    expect(html).not.toContain("admin-panel-description");
    expect(html).not.toContain("admin-panel-footer");
  });

  it("renders description and footer when supplied", () => {
    const html = renderToStaticMarkup(
      <ContextPanel
        title="Verification"
        description="Gameplay accuracy"
        footer={<a href="/admin/settings/game-versions">Manage</a>}
      >
        <p>Body</p>
      </ContextPanel>
    );

    expect(html).toContain("Gameplay accuracy");
    expect(html).toContain("admin-panel-footer");
    expect(html).toContain("Manage");
  });
});

describe("ImagePanel", () => {
  it("shows the empty state with a Choose Image action when there is no image", () => {
    const html = renderToStaticMarkup(
      <ImagePanel imageUrl={null} formId="item-create-form" />
    );

    expect(html).toContain("admin-image-panel-body");
    expect(html).toContain("No image uploaded.");
    expect(html).toContain("PNG, JPEG or WebP · Max 5 MB");
    expect(html).toContain("Choose Image");
    expect(html).not.toContain("Change Image");
    // No existing image, so no remove control or its confirmation note.
    expect(html).not.toContain("admin-image-remove-checkbox");
    expect(html).not.toContain("Remove image");
    expect(html).not.toContain("Image will be removed when saved.");
  });

  it("shows the existing-image state with a preview, Change Image action, and a separate trash button", () => {
    const html = renderToStaticMarkup(
      <ImagePanel
        imageUrl="https://example.test/items/iron-ore.png"
        imageAlt="Current image for Iron Ore"
        formId="item-edit-form"
      />
    );

    expect(html).toContain("admin-image-preview-lg");
    expect(html).toContain('alt="Current image for Iron Ore"');
    expect(html).toContain("PNG, JPEG or WebP · Max 5 MB");
    expect(html).toContain("Change Image");
    expect(html).not.toContain("Choose Image");
    expect(html).not.toContain("No image uploaded.");
    expect(html).toContain("admin-image-trash-btn");
    expect(html).toContain('aria-label="Remove image"');
    expect(html).toContain("Image will be removed when saved.");
  });

  it("keeps the native file input in the DOM, associated with the external form, but out of tab order", () => {
    const html = renderToStaticMarkup(
      <ImagePanel imageUrl={null} formId="item-create-form" />
    );

    expect(html).toContain('type="file"');
    expect(html).toContain('name="image"');
    expect(html).toContain('form="item-create-form"');
    expect(html).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(html).toContain('tabindex="-1"');
  });

  it("accepts a custom title", () => {
    const html = renderToStaticMarkup(
      <ImagePanel title="Recipe image" imageUrl={null} formId="recipe-create-form" />
    );

    expect(html).toContain("Recipe image");
  });
});

describe("VerificationPanel", () => {
  const versions = [
    { id: "v2", name: "Summer Update", isCurrent: true },
    { id: "v1", name: "Launch", isCurrent: false },
  ];

  it("shows Unverified with no stamp rows for an unverified record", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={null}
        verifiedGameVersion={null}
      />
    );

    expect(html).toContain("Unverified");
    expect(html).not.toContain("Verified for");
    expect(html).not.toContain("Verified on");
    expect(html).toContain("Current version");
    expect(html).toContain("Summer Update");
    // The current Game Version carries its own compact Current badge.
    expect(html).toContain("admin-status-badge-current");
  });

  it("shows the current-version status for a record verified against the current version", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={new Date("2026-07-17T10:30:00.000Z")}
        verifiedGameVersion={{ id: "v2", name: "Summer Update" }}
      />
    );

    expect(html).toContain("Verified — current version");
    expect(html).toContain("admin-status-badge-current");
    expect(html).toContain("Verified for");
    expect(html).toContain("2026-07-17");
  });

  it("shows the outdated status for a record verified against an older version", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={new Date("2026-01-05T00:00:00.000Z")}
        verifiedGameVersion={{ id: "v1", name: "Launch" }}
      />
    );

    expect(html).toContain("Verified — older version");
    expect(html).toContain("admin-status-badge-outdated");
    expect(html).toContain("Launch");
    expect(html).toContain("2026-01-05");
  });

  it("composes the real shared picker and opt-in checkbox, defaulting the label to the current version", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={null}
        verifiedGameVersion={null}
      />
    );

    expect(html).toContain('name="verifiedGameVersionId"');
    expect(html).toContain('name="markVerified"');
    expect(html).toContain("Verify this record for");
    expect(html).toContain("Mark as verified for Summer Update");
    // The current version is preselected in the picker, exactly as the
    // shared control has always behaved.
    expect(html).toContain('selected=""');
  });

  it("falls back to generic checkbox wording when no version is current", () => {
    const noCurrentVersions = [{ id: "v1", name: "Launch", isCurrent: false }];
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={noCurrentVersions}
        verifiedAt={null}
        verifiedGameVersion={null}
      />
    );

    expect(html).toContain("Mark as verified for the selected version");
    expect(html).toContain("None");
    expect(html).not.toContain("admin-status-badge-current");
  });

  it("associates the composed picker and checkbox with an external form when rendered outside it", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={null}
        verifiedGameVersion={null}
        formId="item-edit-form"
      />
    );

    expect(html).toMatch(/<select[^>]*form="item-edit-form"[^>]*>/);
    expect(html).toMatch(/<input[^>]*form="item-edit-form"[^>]*name="markVerified"[^>]*>/);
  });

  it("omits the form attribute when no formId is supplied (rendered as a normal form descendant)", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={null}
        verifiedGameVersion={null}
      />
    );

    expect(html).not.toContain("form=");
  });

  it("omits the composed picker and checkbox entirely when readOnly, keeping the status and stamp rows", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={new Date("2026-07-17T10:30:00.000Z")}
        verifiedGameVersion={{ id: "v2", name: "Summer Update" }}
        readOnly
      />
    );

    expect(html).toContain("Verified — current version");
    expect(html).toContain("Verified for");
    expect(html).toContain("Summer Update");
    expect(html).toContain("2026-07-17");
    expect(html).toContain("Current version");
    expect(html).not.toContain('name="verifiedGameVersionId"');
    expect(html).not.toContain('name="markVerified"');
    expect(html).not.toContain("<select");
    expect(html).not.toContain('type="checkbox"');
  });

  it("still shows Current version and Unverified in readOnly mode for an unverified record", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={null}
        verifiedGameVersion={null}
        readOnly
      />
    );

    expect(html).toContain("Unverified");
    expect(html).toContain("Current version");
    expect(html).toContain("Summer Update");
    expect(html).not.toContain("Verified for");
    expect(html).not.toContain('name="verifiedGameVersionId"');
  });
});

describe("TimestampsPanel", () => {
  const createdAt = new Date("2026-07-10T08:00:00.000Z");
  const updatedAt = new Date("2026-07-16T21:00:00.000Z");

  it("renders stable created and updated dates", () => {
    const html = renderToStaticMarkup(
      <TimestampsPanel createdAt={createdAt} updatedAt={updatedAt} />
    );

    expect(html).toContain("Created");
    expect(html).toContain("2026-07-10");
    expect(html).toContain("Updated");
    expect(html).toContain("2026-07-16");
  });

  it("never renders a Verified row — that fact now lives only in VerificationPanel", () => {
    const html = renderToStaticMarkup(
      <TimestampsPanel createdAt={createdAt} updatedAt={updatedAt} />
    );

    expect(html).not.toContain("Verified");
  });
});

describe("EditorActions", () => {
  it("renders a real submit button and a cancel link", () => {
    const html = renderToStaticMarkup(
      <EditorActions submitLabel="Save Changes" cancelHref="/admin/items" />
    );

    expect(html).toContain('type="submit"');
    expect(html).toContain("Save Changes");
    expect(html).toContain('href="/admin/items"');
    expect(html).toContain("Cancel");
  });

  it("never renders a delete action — Delete moved to the aside's DangerZonePanel", () => {
    const html = renderToStaticMarkup(
      <EditorActions submitLabel="Save Changes" cancelHref="/admin/items" />
    );

    expect(html).not.toContain("btn-danger");
    expect(html).not.toContain("Delete");
    expect(html.match(/type="submit"/g)).toHaveLength(1);
  });
});

describe("DangerZonePanel", () => {
  it("renders a destructive link to the existing delete confirmation route, never a submit button", async () => {
    const { DangerZonePanel } = await import("./danger-zone-panel");
    const html = renderToStaticMarkup(
      <DangerZonePanel
        resourceLabel="item"
        deleteHref="/admin/items/iron-ore/delete"
        deleteLabel="Delete Item"
      />
    );

    expect(html).toContain("Danger zone");
    expect(html).toContain("admin-danger-zone");
    expect(html).toContain('href="/admin/items/iron-ore/delete"');
    expect(html).toContain("Delete Item");
    expect(html).toContain("btn-danger");
    expect(html).not.toContain("<form");
    expect(html).not.toContain('type="submit"');
  });
});
