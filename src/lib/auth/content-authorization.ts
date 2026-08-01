import "server-only";

import { redirect } from "next/navigation";
import { requirePermission } from "./authorization";
import { hasPermission, type Capability } from "./permissions";

export function requestsVerification(formData: FormData): boolean {
  return Array.from(formData.entries()).some(
    ([key, value]) => key.endsWith("markVerified") && value === "on"
  );
}

export async function requireContentMutation(
  formData: FormData,
  capability: Extract<Capability, "content.create" | "content.edit">
) {
  const current = await requirePermission(capability);
  if (
    requestsVerification(formData) &&
    !hasPermission(current.user.role, "content.verify")
  ) {
    redirect("/access-denied");
  }
  return current;
}
