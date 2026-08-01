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
  });

  it("allows Contributors to create and edit without delete or verify", () => {
    expect(hasPermission("CONTRIBUTOR", "admin.access")).toBe(true);
    expect(hasPermission("CONTRIBUTOR", "content.create")).toBe(true);
    expect(hasPermission("CONTRIBUTOR", "content.edit")).toBe(true);
    expect(hasPermission("CONTRIBUTOR", "content.delete")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "content.verify")).toBe(false);
    expect(hasPermission("CONTRIBUTOR", "appearance.manage")).toBe(false);
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
