import { notFound } from "next/navigation";
import { AdminSelect } from "@/components/admin/admin-select";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
import { PersonalPermissionControl } from "@/components/admin/personal-permission-control";
import { UsersAccessTabs } from "@/components/admin/users-access-tabs";
import { requirePermission } from "@/lib/auth/authorization";
import { hasEffectivePermission } from "@/lib/auth/permission-resolver";
import {
  loadUserPermissionReadModel,
  protectedPermissionReadModel,
  type PersonalPermissionRowReadModel,
} from "@/lib/auth/permission-read-model";
import { USER_ROLE_LABELS } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { assignableRoles, canManageUser } from "@/lib/users/policy";
import {
  changeUserRoleAction,
  resetUserPasswordAction,
  setUserStatusAction,
} from "../actions";
import {
  USER_MANAGEMENT_ERROR_MESSAGES,
  USER_MANAGEMENT_SUCCESS_MESSAGES,
} from "../messages";

export const dynamic = "force-dynamic";

type MemberDetailPageProps = {
  params: Promise<{ userId: string }>;
  searchParams: Promise<{ error?: string; success?: string }>;
};

function sourceLabel(permission: PersonalPermissionRowReadModel): string {
  switch (permission.effectiveSource) {
    case "OWNER":
      return "Owner authority";
    case "PERSONAL_ALLOW":
      return "Personal allow";
    case "PERSONAL_DENY":
      return "Personal deny";
    case "ROLE":
      return "Role allows";
    case "DEFAULT_DENY":
      return "No grant";
  }
}

export default async function MemberDetailPage({
  params,
  searchParams,
}: MemberDetailPageProps) {
  const { user: actor, permissionContext } = await requirePermission("users.view");
  const { userId } = await params;
  const query = await searchParams;
  const target = await prisma.appUser.findUnique({
    where: { id: userId },
    include: {
      createdBy: { select: { email: true, displayName: true } },
      disabledBy: { select: { email: true, displayName: true } },
    },
  });
  if (!target) {
    notFound();
  }

  const model = await loadUserPermissionReadModel(prisma, target);
  const protectedPermissions = protectedPermissionReadModel();
  const manageable = canManageUser(actor, target);
  const canManageRole =
    manageable &&
    hasEffectivePermission(
      permissionContext,
      "security.members.roles.manage"
    );
  const canManagePersonal =
    manageable &&
    hasEffectivePermission(
      permissionContext,
      "security.members.permissions.manage"
    );
  const canManageStatus =
    manageable &&
    hasEffectivePermission(
      permissionContext,
      "security.members.status.manage"
    );
  const canResetPassword =
    manageable &&
    hasEffectivePermission(
      permissionContext,
      "security.members.password.reset"
    );
  const hasAccountControls =
    canManageRole || canManageStatus || canResetPassword;
  const returnTo = `/admin/users/${target.id}`;
  const errorMessage = query.error
    ? USER_MANAGEMENT_ERROR_MESSAGES[query.error] ??
      "The account operation failed."
    : null;
  const successMessage = query.success
    ? USER_MANAGEMENT_SUCCESS_MESSAGES[query.success] ?? null
    : null;

  return (
    <>
      <EditorHeader
        eyebrow="Member security"
        title={target.displayName || target.email}
        subtitle={
          target.displayName
            ? target.email
            : `${USER_ROLE_LABELS[target.role]} · ${target.status === "ACTIVE" ? "Active" : "Disabled"}`
        }
        backHref="/admin/users"
        backLabel="Member directory"
        status={
          <>
            <span className="admin-status-badge">
              {USER_ROLE_LABELS[target.role]}
            </span>
            <span
              className={
                target.status === "ACTIVE"
                  ? "admin-status-badge admin-status-badge-current"
                  : "admin-status-badge admin-status-badge-outdated"
              }
            >
              {target.status === "ACTIVE" ? "Active" : "Disabled"}
            </span>
          </>
        }
      />

      {errorMessage ? (
        <p role="alert" className="banner banner-error">
          {errorMessage}
        </p>
      ) : null}
      {successMessage ? (
        <p role="status" className="banner banner-success">
          {successMessage}
        </p>
      ) : null}

      <UsersAccessTabs active="members" />

      {model.ownerProtected ? (
        <p className="banner banner-info">
          Owner access is fixed by the Codex. Role, status, password, and
          personal permission controls are read-only on this account.
        </p>
      ) : !manageable ? (
        <p className="banner banner-info">
          You can inspect this member because you have directory access. Only
          the Owner can change account security or personal permissions.
        </p>
      ) : null}

      <div className="security-member-overview">
        <EditorSection
          title="Account record"
          icon={SECTION_ICONS.identity}
          description="Application access and attribution, without authentication credentials."
        >
          <dl className="security-account-facts">
            <div>
              <dt>Email</dt>
              <dd>{target.email}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDisplayDate(target.createdAt)}</dd>
            </div>
            <div>
              <dt>Created by</dt>
              <dd>
                {target.createdBy
                  ? target.createdBy.displayName || target.createdBy.email
                  : "System or bootstrap"}
              </dd>
            </div>
            <div>
              <dt>Last known sign-in</dt>
              <dd>
                {target.lastKnownSignInAt
                  ? formatDisplayDate(target.lastKnownSignInAt)
                  : "No sign-in recorded"}
              </dd>
            </div>
            {target.disabledAt ? (
              <div>
                <dt>Disabled</dt>
                <dd>
                  {formatDisplayDate(target.disabledAt)}
                  {target.disabledBy
                    ? ` by ${target.disabledBy.displayName || target.disabledBy.email}`
                    : ""}
                </dd>
              </div>
            ) : null}
          </dl>
        </EditorSection>

        {hasAccountControls ? (
          <EditorSection
            title="Account controls"
            icon={SECTION_ICONS.verification}
            description="Every security-sensitive change requires explicit confirmation."
          >
            <div className="security-account-controls">
              {canManageRole ? (
                <form action={changeUserRoleAction} className="security-account-control">
                  <input type="hidden" name="userId" value={target.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label className="form-field">
                    <span className="form-field-label">Ordinary role</span>
                    <AdminSelect
                      name="role"
                      defaultValue={target.role}
                      options={assignableRoles(actor.role).map((role) => ({
                        value: role,
                        label: USER_ROLE_LABELS[role],
                      }))}
                    />
                  </label>
                  <label className="form-checkbox-field">
                    <input type="checkbox" name="confirmed" required />
                    <span>Confirm role change</span>
                  </label>
                  <button type="submit" className="btn btn-secondary btn-compact">
                    Update role
                  </button>
                </form>
              ) : null}

              {canManageStatus ? (
                <form action={setUserStatusAction} className="security-account-control">
                  <input type="hidden" name="userId" value={target.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <input
                    type="hidden"
                    name="status"
                    value={target.status === "ACTIVE" ? "DISABLED" : "ACTIVE"}
                  />
                  <div>
                    <strong>
                      {target.status === "ACTIVE"
                        ? "Disable account"
                        : "Restore account"}
                    </strong>
                    <p className="text-muted">
                      {target.status === "ACTIVE"
                        ? "Blocks application requests and asks authentication to revoke access."
                        : "Restores authentication and application access."}
                    </p>
                  </div>
                  <label className="form-checkbox-field">
                    <input type="checkbox" name="confirmed" required />
                    <span>
                      Confirm {target.status === "ACTIVE" ? "disable" : "re-enable"}
                    </span>
                  </label>
                  <button
                    type="submit"
                    className={
                      target.status === "ACTIVE"
                        ? "btn btn-danger-outline btn-compact"
                        : "btn btn-secondary btn-compact"
                    }
                  >
                    {target.status === "ACTIVE"
                      ? "Disable account"
                      : "Re-enable account"}
                  </button>
                </form>
              ) : null}

              {canResetPassword ? (
                <form action={resetUserPasswordAction} className="security-account-control">
                  <input type="hidden" name="userId" value={target.id} />
                  <input type="hidden" name="returnTo" value={returnTo} />
                  <label className="form-field">
                    <span className="form-field-label">New temporary password</span>
                    <input
                      className="form-input"
                      type="password"
                      name="temporaryPassword"
                      minLength={12}
                      maxLength={128}
                      required
                      autoComplete="new-password"
                    />
                    <span className="form-help">
                      Share outside the application and require an immediate change.
                    </span>
                  </label>
                  <label className="form-checkbox-field">
                    <input type="checkbox" name="confirmed" required />
                    <span>Confirm password reset</span>
                  </label>
                  <button type="submit" className="btn btn-secondary btn-compact">
                    Set temporary password
                  </button>
                </form>
              ) : null}
            </div>
          </EditorSection>
        ) : null}
      </div>

      <div className="security-personal-heading">
        <div>
          <p className="admin-editor-eyebrow">Effective access</p>
          <h2>Personal permissions</h2>
          <p>
            Each result follows Role setting → Personal override → Effective
            access. Inherit stores no personal row.
          </p>
        </div>
      </div>

      <div className="security-permission-groups security-permission-groups--personal">
        {model.groups.map((group) => (
          <EditorSection
            key={group.group}
            title={group.group}
            icon={SECTION_ICONS.verification}
            description={`${group.permissions.length} ${group.permissions.length === 1 ? "permission" : "permissions"}`}
          >
            <div className="security-personal-permission-list">
              {group.permissions.map((permission) => {
                const labelId = `permission-${permission.key}`;
                return (
                  <div
                    className="security-personal-permission-row"
                    key={permission.key}
                    role="group"
                    aria-labelledby={labelId}
                  >
                    <div className="security-permission-copy">
                      <div className="security-permission-name-row">
                        <strong id={labelId}>{permission.label}</strong>
                        {permission.dangerous ? (
                          <span className="security-risk-label">Sensitive</span>
                        ) : null}
                      </div>
                      <p>{permission.description}</p>
                    </div>

                    <div className="security-inheritance-state">
                      <span>Role setting</span>
                      <strong>
                        {model.ownerProtected
                          ? "Owner authority"
                          : permission.roleGranted
                            ? "Allowed"
                            : "Not allowed"}
                      </strong>
                    </div>

                    <div className="security-inheritance-state security-inheritance-state--personal">
                      <span>Personal</span>
                      {model.ownerProtected ? (
                        <span className="security-state-badge">System fixed</span>
                      ) : (
                        <PersonalPermissionControl
                          userId={target.id}
                          permission={permission}
                          editable={canManagePersonal}
                        />
                      )}
                    </div>

                    <div className="security-inheritance-state security-inheritance-state--effective">
                      <span>Effective</span>
                      <strong
                        className={
                          permission.effective
                            ? "security-effective security-effective--allowed"
                            : "security-effective security-effective--denied"
                        }
                      >
                        {permission.effective ? "Allowed" : "Denied"}
                      </strong>
                      <small>{sourceLabel(permission)}</small>
                    </div>
                  </div>
                );
              })}
            </div>
          </EditorSection>
        ))}
      </div>

      <EditorSection
        title="Protected authority"
        icon={SECTION_ICONS.verification}
        description="These capabilities are enforced by the Owner invariant and never accept personal overrides."
        className="security-protected-section"
      >
        <div className="security-permission-list">
          {protectedPermissions.map((permission) => (
            <div className="security-permission-row" key={permission.key}>
              <div className="security-permission-copy">
                <div className="security-permission-name-row">
                  <strong>{permission.label}</strong>
                  <span className="security-protected-label">Owner protected</span>
                </div>
                <p>{permission.description}</p>
              </div>
              <span
                className={
                  model.ownerProtected
                    ? "security-state-badge security-state-badge--allowed"
                    : "security-state-badge"
                }
              >
                {model.ownerProtected ? "Allowed to Owner" : "Not delegated"}
              </span>
            </div>
          ))}
        </div>
      </EditorSection>
    </>
  );
}
