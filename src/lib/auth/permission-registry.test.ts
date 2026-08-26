import { describe, expect, it } from "vitest";
import {
  ORDINARY_PERMISSION_KEYS,
  PERMISSION_GROUPS,
  PERMISSION_KEYS,
  PERMISSION_REGISTRY,
  PROTECTED_PERMISSION_KEYS,
  isPermissionKey,
  isProtectedPermission,
} from "./permission-registry";

describe("permission registry", () => {
  it("defines deterministic unique keys with friendly metadata", () => {
    expect(new Set(PERMISSION_KEYS).size).toBe(PERMISSION_KEYS.length);
    expect(PERMISSION_KEYS).toEqual(Object.keys(PERMISSION_REGISTRY));

    for (const key of PERMISSION_KEYS) {
      const definition = PERMISSION_REGISTRY[key];
      expect(definition.label.trim()).not.toBe("");
      expect(definition.description.trim()).not.toBe("");
      expect(PERMISSION_GROUPS).toContain(definition.group);
    }
  });

  it("rejects unknown permission strings", () => {
    expect(isPermissionKey("content.items.edit")).toBe(true);
    expect(isPermissionKey("content.items.superuser")).toBe(false);
    expect(isPermissionKey(null)).toBe(false);
  });

  it("keeps protected permissions out of the ordinary assignable set", () => {
    expect(PROTECTED_PERMISSION_KEYS.length).toBeGreaterThan(0);
    for (const key of PROTECTED_PERMISSION_KEYS) {
      expect(isProtectedPermission(key)).toBe(true);
      expect(ORDINARY_PERMISSION_KEYS).not.toContain(key);
    }
  });
});
