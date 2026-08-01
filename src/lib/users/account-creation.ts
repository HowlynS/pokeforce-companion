import type { UserRole } from "@/lib/auth/roles";

export class ManagedAccountCreationError extends Error {
  constructor(public readonly code: "account_creation_failed" | "application_user_failed" | "creation_recovery_required") {
    super(code);
  }
}

type CreationInput = {
  email: string;
  password: string;
  displayName: string | null;
  role: UserRole;
  createdById: string;
};

type CreationDependencies<T> = {
  createAuthUser(input: Pick<CreationInput, "email" | "password" | "displayName">): Promise<{ id: string }>;
  createApplicationUser(input: Omit<CreationInput, "password"> & { authUserId: string }): Promise<T>;
  deleteAuthUser(authUserId: string): Promise<boolean>;
};

export async function createManagedUserAccount<T>(
  dependencies: CreationDependencies<T>,
  input: CreationInput
): Promise<T> {
  let authUser: { id: string };
  try {
    authUser = await dependencies.createAuthUser({
      email: input.email,
      password: input.password,
      displayName: input.displayName,
    });
  } catch {
    throw new ManagedAccountCreationError("account_creation_failed");
  }

  try {
    return await dependencies.createApplicationUser({
      authUserId: authUser.id,
      email: input.email,
      displayName: input.displayName,
      role: input.role,
      createdById: input.createdById,
    });
  } catch {
    const compensated = await dependencies.deleteAuthUser(authUser.id);
    if (!compensated) {
      throw new ManagedAccountCreationError("creation_recovery_required");
    }
    throw new ManagedAccountCreationError("application_user_failed");
  }
}
