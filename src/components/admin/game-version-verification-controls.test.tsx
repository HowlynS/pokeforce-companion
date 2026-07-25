import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { GameVersionVerificationControls } from "@/components/admin/game-version-verification-controls";

const versions = [
  { id: "v-current", name: "Summer Update", isCurrent: true },
  { id: "v-old", name: "Launch", isCurrent: false },
];

describe("GameVersionVerificationControls repeated-row support", () => {
  it("keeps the established field names and copy by default", () => {
    const html = renderToStaticMarkup(
      <GameVersionVerificationControls gameVersions={versions} />
    );

    expect(html).toContain('name="verifiedGameVersionId"');
    expect(html).toContain('name="markVerified"');
    expect(html).toContain("Mark as verified for Summer Update");
  });

  it("prefixes both fields and labels an independent listing intent", () => {
    const html = renderToStaticMarkup(
      <GameVersionVerificationControls
        gameVersions={versions}
        fieldPrefix="new-1."
        recordNoun="listing"
      />
    );

    expect(html).toContain('name="new-1.verifiedGameVersionId"');
    expect(html).toContain('name="new-1.markVerified"');
    expect(html).toContain(
      "Mark this listing as verified for Summer Update"
    );
    expect(html).toContain("Verify this listing for");
  });

  it("disables both row controls while a removal is pending", () => {
    const html = renderToStaticMarkup(
      <GameVersionVerificationControls
        gameVersions={versions}
        fieldPrefix="existing-listing."
        recordNoun="listing"
        disabled
      />
    );

    expect(html.match(/disabled=""/g)).toHaveLength(2);
  });
});
