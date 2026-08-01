import "server-only";

import { redirect } from "next/navigation";
import {
  getAuthenticatedIdentity,
  getCurrentAppUser,
} from "./current-user";
import {
  hasAnyPermission,
  hasPermission,
  type Capability,
} from "./permissions";

export async function requireSignedInUser() {
  const identity = await getAuthenticatedIdentity();
  if (!identity) {
    redirect("/login");
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

export async function requirePermission(capability: Capability) {
  const current = await requireActiveSiteUser();
  if (!hasPermission(current.user.role, capability)) {
    redirect("/login?error=insufficient_permission");
  }
  return current;
}

export async function requireAnyPermission(
  ...capabilities: readonly Capability[]
) {
  const current = await requireActiveSiteUser();
  if (!hasAnyPermission(current.user.role, capabilities)) {
    redirect("/login?error=insufficient_permission");
  }
  return current;
}

export async function requireOwner() {
  return requirePermission("owners.manage");
}
