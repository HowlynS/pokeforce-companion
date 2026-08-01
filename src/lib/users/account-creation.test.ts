import { describe, expect, it, vi } from "vitest";
import { createManagedUserAccount } from "./account-creation";

const input = {
  email: "member@example.com",
  password: "temporary-secret-value",
  displayName: "Member",
  role: "MEMBER" as const,
  createdById: "owner-1",
};

describe("compensating account creation", () => {
  it("passes the password only to Supabase Auth, never the application row", async () => {
    const createApplicationUser = vi.fn(async (value) => value);
    await createManagedUserAccount(
      {
        createAuthUser: async () => ({ id: "auth-1" }),
        createApplicationUser,
        deleteAuthUser: async () => true,
      },
      input
    );
    expect(createApplicationUser.mock.calls[0][0]).not.toHaveProperty("password");
  });

  it("removes the Auth user when the application row fails", async () => {
    const deleteAuthUser = vi.fn(async () => true);
    await expect(
      createManagedUserAccount(
        {
          createAuthUser: async () => ({ id: "auth-1" }),
          createApplicationUser: async () => { throw new Error("db"); },
          deleteAuthUser,
        },
        input
      )
    ).rejects.toMatchObject({ code: "application_user_failed" });
    expect(deleteAuthUser).toHaveBeenCalledWith("auth-1");
  });

  it("reports manual recovery when compensation also fails", async () => {
    await expect(
      createManagedUserAccount(
        {
          createAuthUser: async () => ({ id: "auth-1" }),
          createApplicationUser: async () => { throw new Error("db"); },
          deleteAuthUser: async () => false,
        },
        input
      )
    ).rejects.toMatchObject({ code: "creation_recovery_required" });
  });
});
