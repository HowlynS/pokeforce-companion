import "server-only";

import { redirect } from "next/navigation";
import { requirePermission } from "./authorization";
import { hasEffectivePermission } from "./permission-resolver";
import type { PermissionKey } from "./permission-registry";

export function requestsVerification(formData: FormData): boolean {
  return Array.from(formData.entries()).some(
    ([key, value]) => key.endsWith("markVerified") && value === "on"
  );
}

export async function requireContentMutation(
  formData: FormData,
  capability: PermissionKey,
  verificationCapability?: PermissionKey
) {
  const current = await requirePermission(capability);
  if (
    requestsVerification(formData) &&
    (!verificationCapability ||
      !hasEffectivePermission(
        current.permissionContext,
        verificationCapability
      ))
  ) {
    redirect("/access-denied");
  }
  return current;
}
