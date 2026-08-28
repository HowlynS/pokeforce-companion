import { ShieldCheck } from "lucide-react";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
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
import { prisma } from "@/lib/db";

export const dynamic = "force-dynamic";

const EDITABLE_ROLES: readonly OrdinaryUserRole[] = [
  "MEMBER",
  "CONTRIBUTOR",
  "ADMINISTRATOR",
];

type RolePoliciesPageProps = {
  searchParams: Promise<{ role?: string }>;
};

export default async function RolePoliciesPage({
  searchParams,
}: RolePoliciesPageProps) {
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

  return (
    <>
      <EditorHeader
        eyebrow="Site administration"
        title="Role policies"
        subtitle="Ordinary role permissions"
        backHref="/admin/users"
        backLabel="Users & access"
        status={
          <span className="admin-status-badge admin-status-badge-current">
            {grantedCount} of {permissionCount} allowed
          </span>
        }
      />
      <p className="security-page-intro">
        Set the shared baseline for each ordinary role. Personal member
        overrides are managed from the member detail view and resolve after
        this role setting.
      </p>

      <UsersAccessTabs active="roles" />

      <nav className="security-role-selector" aria-label="Role policy">
        {EDITABLE_ROLES.map((candidate) => (
          <a
            key={candidate}
            href={`/admin/users/roles?role=${candidate}`}
            className="security-role-selector-link"
            aria-current={candidate === role ? "page" : undefined}
          >
            <span>{USER_ROLE_LABELS[candidate]}</span>
            <small>
              {candidate === "MEMBER"
                ? "Reference access"
                : candidate === "CONTRIBUTOR"
                  ? "Propose changes"
                  : "Maintain the Codex"}
            </small>
          </a>
        ))}
      </nav>

      {!canEdit ? (
        <p className="banner banner-info">
          You can inspect role policy because you may view members. Only the
          Owner can change role permissions.
        </p>
      ) : null}

      <div className="security-permission-groups">
        {model.groups.map((group) => (
          <EditorSection
            key={group.group}
            title={group.group}
            icon={ShieldCheck}
            description={`${group.permissions.length} ${group.permissions.length === 1 ? "permission" : "permissions"}`}
          >
            <div className="security-permission-list">
              {group.permissions.map((permission) => (
                <div className="security-permission-row" key={permission.key}>
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
            </div>
          </EditorSection>
        ))}
      </div>

      <EditorSection
        title="Protected Owner Permissions"
        icon={ShieldCheck}
        description="The Owner is system-protected and always has every registered permission. These permissions cannot be assigned to ordinary roles."
        className="security-protected-section"
      >
        <div className="security-permission-list">
          {protectedPermissions.map((permission) => (
            <div className="security-permission-row" key={permission.key}>
              <div className="security-permission-copy">
                <div className="security-permission-name-row">
                  <strong>{permission.label}</strong>
                  <span className="security-protected-label">
                    Owner protected
                  </span>
                </div>
                <p>{permission.description}</p>
              </div>
              <span className="security-state-badge">Fixed by system</span>
            </div>
          ))}
        </div>
      </EditorSection>
    </>
  );
}
