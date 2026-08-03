import { describe, expect, it } from "vitest";
import {
  CAPABILITIES,
  hasPermission,
  permissionsForRole,
} from "./permissions";

describe("role capability presets", () => {
  it("keeps Members outside admin and mutation capabilities", () => {
    expect(hasPermission("MEMBER", "site.access.private")).toBe(true);
    expect(hasPermission("MEMBER", "admin.access")).toBe(false);
    expect(hasPermission("MEMBER", "content.edit")).toBe(false);
    expect(hasPermission("MEMBER", "content.verify")).toBe(false);
  });

  it("allows Contributors to verify without granting delete or Site administration", () => {
    expect(permissionsForRole("CONTRIBUTOR")).toEqual([
      "site.access.private",
      "admin.access",
      "content.create",
      "content.edit",
      "content.verify",
      "content.images.manage",
    ]);
    expect(hasPermission("CONTRIBUTOR", "content.delete")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "gameVersions.manage")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "appearance.manage")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "designReview.access")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "users.view")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "audit.view")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "visibility.change")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "owners.manage")).toBe(false);
  });

  it("keeps Administrator account management below Owner authority", () => {
    expect(hasPermission("ADMINISTRATOR", "users.create")).toBe(true);
    expect(hasPermission("ADMINISTRATOR", "audit.view")).toBe(true);
    expect(hasPermission("ADMINISTRATOR", "visibility.change")).toBe(false);
    expect(hasPermission("ADMINISTRATOR", "owners.manage")).toBe(false);
  });

  it("grants Owners every registered capability", () => {
    expect(permissionsForRole("OWNER")).toEqual(CAPABILITIES);
  });
});
