import { beforeEach, describe, expect, it, vi } from "vitest";
import { createPermissionContext } from "./permission-resolver";

const authorizationMocks = vi.hoisted(() => ({
  requirePermission: vi.fn(),
}));

vi.mock("./authorization", () => authorizationMocks);
vi.mock("next/navigation", () => ({
  redirect(path: string): never {
    throw new Error(`redirect:${path}`);
  },
}));

import {
  requestsVerification,
  requireContentMutation,
} from "./content-authorization";

beforeEach(() => {
  authorizationMocks.requirePermission.mockReset();
});

function authorizedContext(input?: {
  rolePermissionKeys?: readonly string[];
  overrides?: ReadonlyArray<{
    permissionKey: string;
    effect: "ALLOW" | "DENY";
  }>;
}) {
  const user = { id: "admin-1", role: "ADMINISTRATOR" as const };
  return {
    identity: { id: "auth-user", email: "actor@example.com" },
    user: { ...user, status: "ACTIVE" as const },
    permissionContext: createPermissionContext({
      user,
      rolePermissionKeys: input?.rolePermissionKeys,
      userOverrides: input?.overrides,
    }),
  };
}

describe("verification mutation detection", () => {
  it("ignores ordinary edits and unchecked verification controls", () => {
    const data = new FormData();
    data.set("name", "Iron Ore");
    data.set("markVerified", "");
    expect(requestsVerification(data)).toBe(false);
  });

  it("detects root and nested forged verification requests", () => {
    const root = new FormData();
    root.set("markVerified", "on");
    expect(requestsVerification(root)).toBe(true);

    const nested = new FormData();
    nested.set("listing.0.markVerified", "on");
    expect(requestsVerification(nested)).toBe(true);
  });

  it("accepts verification when the effective context allows it", async () => {
    authorizationMocks.requirePermission.mockResolvedValue(
      authorizedContext({
        rolePermissionKeys: [
          "content.items.edit",
          "content.items.verify",
        ],
      })
    );
    const data = new FormData();
    data.set("markVerified", "on");

    await expect(
      requireContentMutation(
        data,
        "content.items.edit",
        "content.items.verify"
      )
    ).resolves.toMatchObject({ user: { role: "ADMINISTRATOR" } });
  });

  it("lets personal DENY block role-granted verification", async () => {
    authorizationMocks.requirePermission.mockResolvedValue(
      authorizedContext({
        rolePermissionKeys: [
          "content.items.edit",
          "content.items.verify",
        ],
        overrides: [
          { permissionKey: "content.items.verify", effect: "DENY" },
        ],
      })
    );
    const data = new FormData();
    data.set("markVerified", "on");

    await expect(
      requireContentMutation(
        data,
        "content.items.edit",
        "content.items.verify"
      )
    ).rejects.toThrow("redirect:/access-denied");
  });

  it("does not proceed when the canonical mutation permission fails", async () => {
    authorizationMocks.requirePermission.mockRejectedValue(
      new Error("redirect:/access-denied")
    );
    await expect(
      requireContentMutation(
        new FormData(),
        "content.items.edit",
        "content.items.verify"
      )
    ).rejects.toThrow("redirect:/access-denied");
  });
});
