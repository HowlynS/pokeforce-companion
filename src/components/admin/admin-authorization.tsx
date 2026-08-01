"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/auth/roles";
import { hasPermission, type Capability } from "@/lib/auth/permissions";

const AdminRoleContext = createContext<UserRole | null>(null);

export function AdminAuthorizationProvider({
  role,
  children,
}: {
  role: UserRole;
  children: React.ReactNode;
}) {
  return (
    <AdminRoleContext.Provider value={role}>
      {children}
    </AdminRoleContext.Provider>
  );
}

export function useAdminPermission(capability: Capability): boolean {
  const role = useAdminRole();
  return role ? hasPermission(role, capability) : false;
}

export function useAdminRole(): UserRole | null {
  return useContext(AdminRoleContext);
}

export function AdminPermissionBoundary({
  capability,
  children,
}: {
  capability: Capability;
  children: React.ReactNode;
}) {
  return useAdminPermission(capability) ? children : null;
}
