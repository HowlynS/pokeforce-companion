"use client";

import { createContext, useContext } from "react";
import type { UserRole } from "@/lib/auth/roles";
import type { PermissionKey } from "@/lib/auth/permission-registry";
import { PERMISSION_KEYS } from "@/lib/auth/permission-registry";

type AdminAuthorization = {
  role: UserRole;
  permissions: ReadonlySet<PermissionKey>;
};

const AdminAuthorizationContext = createContext<AdminAuthorization | null>(null);

export function AdminAuthorizationProvider({
  role,
  permissions = role === "OWNER" ? PERMISSION_KEYS : [],
  children,
}: {
  role: UserRole;
  permissions?: readonly PermissionKey[];
  children: React.ReactNode;
}) {
  return (
    <AdminAuthorizationContext.Provider
      value={{ role, permissions: new Set(permissions) }}
    >
      {children}
    </AdminAuthorizationContext.Provider>
  );
}

export function useAdminPermission(capability: PermissionKey): boolean {
  return useAdminAuthorization()?.permissions.has(capability) ?? false;
}

export function useAdminRole(): UserRole | null {
  return useAdminAuthorization()?.role ?? null;
}

export function useAdminPermissions(): ReadonlySet<PermissionKey> {
  return useAdminAuthorization()?.permissions ?? new Set();
}

function useAdminAuthorization(): AdminAuthorization | null {
  return useContext(AdminAuthorizationContext);
}

export function AdminPermissionBoundary({
  capability,
  children,
}: {
  capability: PermissionKey;
  children: React.ReactNode;
}) {
  return useAdminPermission(capability) ? children : null;
}
