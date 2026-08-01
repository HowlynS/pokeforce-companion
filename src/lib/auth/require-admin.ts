import "server-only";

import { cache } from "react";
import { requirePermission } from "./authorization";

/**
 * Compatibility boundary for ordinary gameplay-admin reads. New restricted
 * workspaces and every mutation use their specific capability directly.
 */
export const requireAdminUser = cache(async function requireAdminUser() {
  const current = await requirePermission("admin.access");
  return current.identity;
});
