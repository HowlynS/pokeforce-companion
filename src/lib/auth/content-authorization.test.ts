import { beforeEach, describe, expect, it, vi } from "vitest";

const currentUserMocks = vi.hoisted(() => ({
  getAuthenticatedIdentity: vi.fn(),
  getCurrentAppUser: vi.fn(),
}));

vi.mock("./current-user", () => currentUserMocks);
vi.mock("next/navigation", () => ({
  redirect(path: string): never {
    throw new Error(`redirect:${path}`);
  },
}));

import {
  requestsVerification,
  requireContentMutation,
} from "./content-authorization";

const IDENTITY = { id: "auth-user", email: "actor@example.com" };

beforeEach(() => {
  currentUserMocks.getAuthenticatedIdentity.mockReset();
  currentUserMocks.getCurrentAppUser.mockReset();
});

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

  it("accepts an explicit Contributor verification request", async () => {
    currentUserMocks.getAuthenticatedIdentity.mockResolvedValue(IDENTITY);
    currentUserMocks.getCurrentAppUser.mockResolvedValue({
      role: "CONTRIBUTOR",
      status: "ACTIVE",
    });
    const data = new FormData();
    data.set("markVerified", "on");

    await expect(
      requireContentMutation(data, "content.edit")
    ).resolves.toMatchObject({
      user: { role: "CONTRIBUTOR" },
    });
  });

  it("rejects forged Member verification input before the mutation runs", async () => {
    currentUserMocks.getAuthenticatedIdentity.mockResolvedValue(IDENTITY);
    currentUserMocks.getCurrentAppUser.mockResolvedValue({
      role: "MEMBER",
      status: "ACTIVE",
    });
    const data = new FormData();
    data.set("markVerified", "on");

    await expect(requireContentMutation(data, "content.edit")).rejects.toThrow(
      "redirect:/access-denied"
    );
  });

  it("rejects forged unauthenticated verification input before the mutation runs", async () => {
    currentUserMocks.getAuthenticatedIdentity.mockResolvedValue(null);
    const data = new FormData();
    data.set("markVerified", "on");

    await expect(requireContentMutation(data, "content.edit")).rejects.toThrow(
      "redirect:/login"
    );
    expect(currentUserMocks.getCurrentAppUser).not.toHaveBeenCalled();
  });
});
