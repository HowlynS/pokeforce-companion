// Public authorization barrel. Permission definitions live only in the
// registry; effective decisions live only in the resolver.
export {
  ORDINARY_PERMISSION_KEYS,
  PERMISSION_KEYS as CAPABILITIES,
  PERMISSION_REGISTRY,
  PROTECTED_PERMISSION_KEYS,
  isPermissionKey,
  isProtectedPermission,
  type PermissionKey as Capability,
  type PermissionKey,
} from "./permission-registry";

export {
  createPermissionContext,
  effectivePermissionKeys as permissionsForContext,
  hasEffectivePermission as hasPermission,
  loadPermissionContext,
  type PermissionContext,
} from "./permission-resolver";
