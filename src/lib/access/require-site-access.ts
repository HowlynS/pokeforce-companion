import "server-only";

import { getCurrentAppUser } from "@/lib/auth/current-user";
import { requirePermission } from "@/lib/auth/authorization";
import { getSiteVisibility } from "./visibility";

export async function requireOrdinarySiteAccess() {
  if ((await getSiteVisibility()) === "PUBLIC") {
    return null;
  }
  return requirePermission("site.access.private");
}

export async function canExposePublicContent(): Promise<boolean> {
  if ((await getSiteVisibility()) === "PUBLIC") {
    return true;
  }
  const user = await getCurrentAppUser();
  return user?.status === "ACTIVE";
}
