import { EditorHeader } from "@/components/admin/editor-header";
import { PermissionGroupSection } from "@/components/admin/permission-group-section";
import { ProtectedPermissionPanel } from "@/components/admin/protected-permission-panel";
import { RolePermissionControl } from "@/components/admin/role-permission-control";
import { UsersAccessTabs } from "@/components/admin/users-access-tabs";
import { requirePermission } from "@/lib/auth/authorization";
import { hasEffectivePermission } from "@/lib/auth/permission-resolver";
import {
  loadRolePermissionReadModel,
  ordinaryRoleFrom,
  protectedPermissionReadModel,
  type OrdinaryUserRole,
} from "@/lib/auth/permission-read-model";
import { USER_ROLE_LABELS } from "@/lib/auth/roles";
import { ORDINARY_ROLE_COPY } from "@/lib/admin/role-policy-copy";
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const EDITABLE_ROLES: readonly OrdinaryUserRole[] = [
  "MEMBER",
  "CONTRIBUTOR",
  "ADMINISTRATOR",
];

export default async function RolePoliciesPage({
  searchParams,
}: {
  searchParams: Promise<{ role?: string }>;
}) {
  const { permissionContext } = await requirePermission("users.view");
  const { role: requestedRole } = await searchParams;
  const role = ordinaryRoleFrom(requestedRole);
  const model = await loadRolePermissionReadModel(prisma, role);
  const protectedPermissions = protectedPermissionReadModel();
  const canEdit = hasEffectivePermission(
    permissionContext,
    "security.roles.permissions.manage"
  );
  const grantedCount = model.groups.reduce(
    (count, group) =>
      count + group.permissions.filter(({ granted }) => granted).length,
    0
  );
  const permissionCount = model.groups.reduce(
    (count, group) => count + group.permissions.length,
    0
  );
  const roleLabel = USER_ROLE_LABELS[role];

  return (
    <>
      <EditorHeader
        eyebrow="Site administration"
        title="Role policies"
        subtitle="Ordinary role permissions"
        backHref="/admin/users"
        backLabel="Users & access"
      />
      <p className="security-page-intro">
        Set the shared baseline for each ordinary role. Personal member
        overrides are managed from the member detail view and resolve after
        this role setting.
      </p>

      <UsersAccessTabs active="roles" />

      <div className="security-ledger">
        <nav className="security-role-rail" aria-label="Role policy">
          {EDITABLE_ROLES.map((candidate) => (
            <a
              key={candidate}
              href={`/admin/users/roles?role=${candidate}`}
              className="security-role-chip"
              aria-current={candidate === role ? "page" : undefined}
            >
              <span>{USER_ROLE_LABELS[candidate]}</span>
              <small>{ORDINARY_ROLE_COPY[candidate].tagline}</small>
            </a>
          ))}
        </nav>

        <div className="security-role-identity">
          <div className="security-role-identity-copy">
            <p className="security-role-identity-eyebrow">Editing role policy</p>
            <h2 className="security-role-identity-name">{roleLabel}</h2>
            <p className="security-role-identity-summary">
              {ORDINARY_ROLE_COPY[role].summary}
            </p>
          </div>
          <p className="security-role-identity-tally">
            <strong>{grantedCount}</strong>
            <span>
              of {permissionCount} permissions allowed for {roleLabel}
            </span>
          </p>
        </div>

        {!canEdit ? (
          <p className="banner banner-info">
            You can inspect role policy because you may view members. Only the
            Owner can change role permissions.
          </p>
        ) : null}

        <div className="security-permission-groups">
          {model.groups.map((group) => {
            const allowed = group.permissions.filter(
              ({ granted }) => granted
            ).length;
            return (
              <PermissionGroupSection
                key={group.group}
                title={group.group}
                meta={`${allowed} of ${group.permissions.length} allowed`}
              >
                {group.permissions.map((permission) => (
                  <div
                    className={
                      permission.dangerous
                        ? "security-permission-row security-permission-row--sensitive"
                        : "security-permission-row"
                    }
                    key={permission.key}
                  >
                    <div className="security-permission-copy">
                      <div className="security-permission-name-row">
                        <strong>{permission.label}</strong>
                        {permission.dangerous ? (
                          <span className="security-risk-label">Sensitive</span>
                        ) : null}
                      </div>
                      <p>{permission.description}</p>
                    </div>
                    <RolePermissionControl
                      role={role}
                      permission={permission}
                      editable={canEdit}
                    />
                  </div>
                ))}
              </PermissionGroupSection>
            );
          })}
        </div>

        <ProtectedPermissionPanel
          lead={`The Owner is system-protected and always holds every registered permission. These powers cannot be granted to ${roleLabel} or to any other ordinary role.`}
          entries={protectedPermissions.map((permission) => ({
            key: permission.key,
            label: permission.label,
            description: permission.description,
          }))}
        />
      </div>
    </>
  );
}
