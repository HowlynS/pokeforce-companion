import { describe, expect, it } from "vitest";
import { INITIAL_ROLE_PERMISSION_PRESETS } from "./permission-presets";
import { isProtectedPermission } from "./permission-registry";

describe("initial role permission presets", () => {
  it("keeps Members read-only", () => {
    expect(INITIAL_ROLE_PERMISSION_PRESETS.MEMBER).toEqual([
      "site.access.private",
    ]);
  });

  it("gives Contributors proposal permissions without canonical mutation", () => {
    expect(INITIAL_ROLE_PERMISSION_PRESETS.CONTRIBUTOR).toContain(
      "contributions.submit"
    );
    expect(INITIAL_ROLE_PERMISSION_PRESETS.CONTRIBUTOR).toContain(
      "contributions.withdraw-own"
    );
    expect(
      INITIAL_ROLE_PERMISSION_PRESETS.CONTRIBUTOR.some((key) =>
        key.startsWith("content.")
      )
    ).toBe(false);
  });

  it("gives Administrators operational defaults with bounded deletion", () => {
    const preset: readonly string[] =
      INITIAL_ROLE_PERMISSION_PRESETS.ADMINISTRATOR;
    expect(preset).toContain("content.items.delete");
    expect(preset).toContain("content.locations.delete");
    expect(preset).toContain("content.shops.delete");
    expect(preset).not.toContain("content.categories.delete");
  });

  it("never places protected authority in an editable role preset", () => {
    for (const permissions of Object.values(INITIAL_ROLE_PERMISSION_PRESETS)) {
      expect(permissions.some(isProtectedPermission)).toBe(false);
    }
    expect(INITIAL_ROLE_PERMISSION_PRESETS.OWNER).toEqual([]);
  });
});
