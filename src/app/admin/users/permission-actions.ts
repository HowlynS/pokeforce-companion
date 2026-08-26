"use server";

import { revalidatePath } from "next/cache";
import { requireOwner } from "@/lib/auth/authorization";
import {
  PermissionManagementError,
  setRolePermission,
  setUserPermissionOverride,
} from "@/lib/auth/permission-management";
import { prisma } from "@/lib/db";

type SecurityMutationResult =
  | { ok: true; changed: boolean }
  | { ok: false; error: string };

function friendlySecurityError(error: unknown): SecurityMutationResult {
  if (!(error instanceof PermissionManagementError)) {
    return { ok: false, error: "The change could not be saved." };
  }

  const messages: Record<string, string> = {
    invalid_permission: "Choose a valid permission.",
    invalid_grant: "Choose whether this role should be allowed to use the permission.",
    protected_permission: "That setting is protected by the Codex.",
    invalid_role: "Choose a valid role.",
    owner_protected: "Owner access cannot be changed here.",
    invalid_override: "Choose Use role setting, Allow, or Deny.",
    missing_user: "That member could not be found.",
    permission_denied: "Only the Owner can change member permissions.",
  };
  return {
    ok: false,
    error: messages[error.code] ?? "The change could not be saved.",
  };
}

export async function updateRolePermissionAction(
  formData: FormData
): Promise<SecurityMutationResult> {
  const { user: actor } = await requireOwner();
  const operation = String(formData.get("operation") ?? "");
  if (operation !== "grant" && operation !== "revoke") {
    return { ok: false, error: "Choose whether to allow or remove this setting." };
  }

  try {
    const result = await setRolePermission(
      prisma,
      actor.id,
      formData.get("role"),
      formData.get("permissionKey"),
      operation === "grant"
    );
    revalidatePath("/admin/users");
    return { ok: true, changed: result.changed };
  } catch (error) {
    return friendlySecurityError(error);
  }
}

export async function updatePersonalPermissionAction(
  formData: FormData
): Promise<SecurityMutationResult> {
  const { user: actor } = await requireOwner();
  const effectValue = String(formData.get("effect") ?? "");
  const effect = effectValue === "INHERIT" ? null : effectValue;

  try {
    const result = await setUserPermissionOverride(
      prisma,
      actor.id,
      String(formData.get("userId") ?? ""),
      formData.get("permissionKey"),
      effect
    );
    revalidatePath("/admin/users");
    return { ok: true, changed: result.changed };
  } catch (error) {
    return friendlySecurityError(error);
  }
}
