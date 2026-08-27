import "server-only";

import { cache } from "react";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import {
  getAuthenticatedIdentity,
  getCurrentAppUser,
} from "./current-user";
import {
  hasEffectivePermission,
  loadPermissionContext,
} from "./permission-resolver";
import type { PermissionKey } from "./permission-registry";
import { loginPathFor } from "./return-path";

export async function requireSignedInUser(returnTo?: string) {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    redirect(loginPathFor(returnTo));
  }
  return identity;
}

export async function requireActiveSiteUser() {
  const identity = await requireSignedInUser();
  const user = await getCurrentAppUser();

  if (!user) {
    redirect("/login?error=unprovisioned");
  }
  if (user.status !== "ACTIVE") {
    redirect("/login?error=disabled");
  }

  return { identity, user };
}

export const getCurrentPermissionContext = cache(
  async function getCurrentPermissionContext() {
    const current = await requireActiveSiteUser();
    const permissionContext = await loadPermissionContext(prisma, current.user);
    return { ...current, permissionContext };
  }
);

export async function requirePermission(capability: PermissionKey) {
  const current = await getCurrentPermissionContext();
  if (!hasEffectivePermission(current.permissionContext, capability)) {
    redirect("/access-denied");
  }
  return current;
}

export async function requireAnyPermission(
  ...capabilities: readonly PermissionKey[]
) {
  const current = await getCurrentPermissionContext();
  if (
    !capabilities.some((capability) =>
      hasEffectivePermission(current.permissionContext, capability)
    )
  ) {
    redirect("/access-denied");
  }
  return current;
}

export async function requireOwner() {
  return requirePermission("security.ownership.manage");
}
