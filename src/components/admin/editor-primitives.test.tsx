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
  it("wraps the existing upload controls in the pointer-cursor body without altering them", () => {
    const html = renderToStaticMarkup(
      <ImagePanel>
        <input type="file" name="image" accept="image/png" />
      </ImagePanel>
    );

    // The wrapper class is the CSS hook that applies cursor: pointer to
    // every upload surface inside; the input itself passes through with
    // its props intact — no upload behavior lives in this component.
    expect(html).toContain("admin-image-panel-body");
    expect(html).toMatch(
      /<input [^>]*type="file"[^>]*>|<input [^>]*name="image"[^>]*>/
    );
    expect(html).toContain('type="file"');
    expect(html).toContain('name="image"');
    expect(html).toContain('accept="image/png"');
    expect(html).toContain("Image");
  });

  it("accepts a custom title and description", () => {
    const html = renderToStaticMarkup(
      <ImagePanel title="Recipe image" description="PNG, JPEG, or WebP">
        <input type="file" name="image" />
      </ImagePanel>
    );

    expect(html).toContain("Recipe image");
    expect(html).toContain("PNG, JPEG, or WebP");
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
    expect(html).not.toContain("Verified against");
    expect(html).not.toContain("Verified on");
    expect(html).toContain("Current version");
    expect(html).toContain("Summer Update");
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
    expect(html).toContain("Verified against");
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

  it("composes the real shared picker and opt-in checkbox", () => {
    const html = renderToStaticMarkup(
      <VerificationPanel
        gameVersions={versions}
        verifiedAt={null}
        verifiedGameVersion={null}
      />
    );

    expect(html).toContain('name="verifiedGameVersionId"');
    expect(html).toContain('name="markVerified"');
    expect(html).toContain(
      "Mark gameplay data as verified for the selected game version."
    );
    // The current version is preselected in the picker, exactly as the
    // shared control has always behaved.
    expect(html).toContain('selected=""');
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
    expect(html).toContain("Verified against");
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
    expect(html).not.toContain("Verified against");
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

  it("omits the verification row when there is no stamp", () => {
    const html = renderToStaticMarkup(
      <TimestampsPanel createdAt={createdAt} updatedAt={updatedAt} />
    );

    expect(html).not.toContain("Verified");
  });

  it("includes the verification row when a stamp exists", () => {
    const html = renderToStaticMarkup(
      <TimestampsPanel
        createdAt={createdAt}
        updatedAt={updatedAt}
        verifiedAt={new Date("2026-07-17T00:00:00.000Z")}
      />
    );

    expect(html).toContain("Verified");
    expect(html).toContain("2026-07-17");
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

  it("omits the delete action when no delete href is supplied", () => {
    const html = renderToStaticMarkup(
      <EditorActions submitLabel="Save Changes" cancelHref="/admin/items" />
    );

    expect(html).not.toContain("btn-danger");
    expect(html).not.toContain("Delete");
  });

  it("links the optional delete action to the existing confirmation route", () => {
    const html = renderToStaticMarkup(
      <EditorActions
        submitLabel="Save Changes"
        cancelHref="/admin/items"
        deleteHref="/admin/items/iron-ore/delete"
      />
    );

    expect(html).toContain('href="/admin/items/iron-ore/delete"');
    expect(html).toContain("Delete");
    expect(html).toContain("btn-danger");
    // The delete control is a LINK to the confirmation page, never a
    // second submit button inside the edit form.
    expect(html.match(/type="submit"/g)).toHaveLength(1);
  });
});
