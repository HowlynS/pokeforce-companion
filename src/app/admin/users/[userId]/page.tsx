import { notFound } from "next/navigation";
import { AdminSelect } from "@/components/admin/admin-select";
import { EditorHeader } from "@/components/admin/editor-header";
import { EditorSection } from "@/components/admin/editor-section";
import { PermissionGroupSection } from "@/components/admin/permission-group-section";
import { PersonalPermissionControl } from "@/components/admin/personal-permission-control";
import { ProtectedPermissionPanel } from "@/components/admin/protected-permission-panel";
import { SecurityFormSubmitButton } from "@/components/admin/security-form-submit-button";
import { UsersAccessTabs } from "@/components/admin/users-access-tabs";
import { requirePermission } from "@/lib/auth/authorization";
import { hasEffectivePermission } from "@/lib/auth/permission-resolver";
import {
  loadUserPermissionReadModel,
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

function sourceLabel(
  permission: PersonalPermissionRowReadModel,
  roleLabel: string
): string {
  switch (permission.effectiveSource) {
    case "OWNER":
      return "Protected Owner access";
    case "PERSONAL_ALLOW":
      return "Allowed for this member";
    case "PERSONAL_DENY":
      return "Denied for this member";
    case "ROLE":
      return `Allowed through ${roleLabel}`;
    case "DEFAULT_DENY":
      return `Not allowed through ${roleLabel}`;
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
  // Role assignment moved out of "Account controls" and in beside the
  // permission story, so this card is now shown for the account-lifecycle
  // permissions alone. Every underlying capability check is unchanged —
  // only where each control renders moved.
  const hasAccountControls = canManageStatus || canResetPassword;
  const returnTo = `/admin/users/${target.id}`;
  const roleLabel = USER_ROLE_LABELS[target.role];
  const errorMessage = query.error
    ? USER_MANAGEMENT_ERROR_MESSAGES[query.error] ??
      "The account operation failed."
    : null;
  const successMessage = query.success
    ? USER_MANAGEMENT_SUCCESS_MESSAGES[query.success] ?? null
    : null;
  const personalExceptions = model.groups.reduce(
    (count, group) =>
      count +
      group.permissions.filter(
        ({ personalSetting }) => personalSetting !== "INHERIT"
      ).length,
    0
  );

  return (
    <>
      <EditorHeader
        eyebrow="Member security"
        title={target.displayName || target.email}
        subtitle={target.displayName ? target.email : undefined}
        backHref="/admin/users"
        backLabel="Member directory"
        status={
          <>
            <span className="admin-status-badge">{roleLabel}</span>
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

      <div className="security-ledger">
        {/* The Owner's own protection is stated by the Role block below,
            which shows it as reserved authority rather than as a notice
            about missing controls. Everyone else who may only look gets
            the plain explanation. */}
        {!model.ownerProtected && !manageable ? (
          <p className="banner banner-info">
            You can inspect this member because you have directory access. Only
            the Owner can change account security or personal permissions.
          </p>
        ) : null}

        <div
          className={
            hasAccountControls
              ? "security-member-overview"
              : "security-member-overview security-member-overview--single"
          }
        >
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
              icon={SECTION_ICONS.dangerZone}
              description="Access to the account itself, not what it may do. Every change here requires explicit confirmation."
            >
              <div className="security-account-controls">
                {canManageStatus ? (
                  <form
                    action={setUserStatusAction}
                    className="security-account-control"
                  >
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
                        Confirm{" "}
                        {target.status === "ACTIVE" ? "disable" : "re-enable"}
                      </span>
                    </label>
                    <SecurityFormSubmitButton
                      className={
                        target.status === "ACTIVE"
                          ? "btn btn-danger-outline btn-compact"
                          : "btn btn-secondary btn-compact"
                      }
                      pendingLabel={
                        target.status === "ACTIVE"
                          ? "Disabling account…"
                          : "Re-enabling account…"
                      }
                    >
                      {target.status === "ACTIVE"
                        ? "Disable account"
                        : "Re-enable account"}
                    </SecurityFormSubmitButton>
                  </form>
                ) : null}

                {canResetPassword ? (
                  <form
                    action={resetUserPasswordAction}
                    className="security-account-control"
                  >
                    <input type="hidden" name="userId" value={target.id} />
                    <input type="hidden" name="returnTo" value={returnTo} />
                    <div>
                      <strong>Reset password</strong>
                      <p className="text-muted">
                        Replaces this member&apos;s sign-in password with one
                        you set here.
                      </p>
                    </div>
                    <label className="form-field">
                      <span className="form-field-label">
                        New temporary password
                      </span>
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
                        Share outside the application and require an immediate
                        change.
                      </span>
                    </label>
                    <label className="form-checkbox-field">
                      <input type="checkbox" name="confirmed" required />
                      <span>Confirm password reset</span>
                    </label>
                    <SecurityFormSubmitButton
                      className="btn btn-secondary btn-compact"
                      pendingLabel="Setting password…"
                    >
                      Set temporary password
                    </SecurityFormSubmitButton>
                  </form>
                ) : null}
              </div>
            </EditorSection>
          ) : null}
        </div>

        {/* Role, then personal exception, then effective result: the page is
            ordered the way the resolution itself runs, so the hierarchy is
            visible before a single permission row is read. */}
        <div className="security-role-block">
          <div className="security-role-block-copy">
            <p className="security-role-identity-eyebrow">
              {model.ownerProtected ? "Protected authority" : "Role"}
            </p>
            <h3>{model.ownerProtected ? "Owner" : roleLabel}</h3>
            <p>
              {model.ownerProtected
                ? "Owner access is fixed by the Codex. It is not an editable role policy, so role, status, password, and personal permission controls are read-only on this account."
                : `The shared baseline this member starts from. What ${roleLabel} allows is set once in Role policies and applies to every member holding that role.`}
            </p>
          </div>

          {canManageRole ? (
            <form action={changeUserRoleAction} className="security-role-form">
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
              <SecurityFormSubmitButton
                className="btn btn-secondary btn-compact"
                pendingLabel="Updating role…"
              >
                Update role
              </SecurityFormSubmitButton>
            </form>
          ) : null}
        </div>

        {/* The Owner is not an ordinary member with every switch turned on,
            so the Owner record never renders the tri-state ledger at all.
            Showing forty-six identical read-only rows would say "same page,
            all on"; a group summary says "system-protected authority". */}
        {model.ownerProtected ? (
          <>
            <div className="security-personal-heading">
              <p className="admin-editor-eyebrow">Effective access</p>
              <h2>Codex access</h2>
              <p>
                The Owner holds every registered permission in every area of
                the Codex. There is no role policy and no personal exception to
                set here, because Owner access does not resolve through them.
              </p>
            </div>

            <ul className="security-owner-grid">
              {model.groups.map((group) => (
                <li className="security-owner-tile" key={group.group}>
                  <strong>{group.group}</strong>
                  <span>
                    All {group.permissions.length}{" "}
                    {group.permissions.length === 1
                      ? "permission"
                      : "permissions"}{" "}
                    allowed
                  </span>
                </li>
              ))}
            </ul>
          </>
        ) : (
          <>
            <div className="security-personal-heading">
              <p className="admin-editor-eyebrow">Effective access</p>
              <h2>Personal permissions</h2>
              <p>
                A personal setting is an exception for this member alone. Left
                on <strong>Use role setting</strong>, the {roleLabel} policy
                decides; choose Allow or Deny and this member departs from it.{" "}
                {personalExceptions === 0
                  ? `No personal exception is set, so this member follows ${roleLabel} exactly.`
                  : `${personalExceptions} personal ${personalExceptions === 1 ? "exception is" : "exceptions are"} set for this member.`}
              </p>
            </div>

            <div className="security-permission-groups security-permission-groups--personal">
          {model.groups.map((group) => (
            <PermissionGroupSection
              key={group.group}
              title={group.group}
              columns={
                <>
                  <span>Permission</span>
                  <span>Role setting</span>
                  <span>Personal setting</span>
                  <span>Effective result</span>
                </>
              }
            >
              {group.permissions.map((permission) => {
                const labelId = `permission-${permission.key}`;
                return (
                  <div
                    className={
                      permission.dangerous
                        ? "security-personal-permission-row security-permission-row--sensitive"
                        : "security-personal-permission-row"
                    }
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

                    {/* Each cell keeps its own label in the DOM for assistive
                        technology; the group's column header carries it
                        visually once the ledger is wide enough to align. */}
                    <div className="security-inheritance-state security-inheritance-state--role">
                      <span className="security-state-label">Role setting</span>
                      <strong>
                        {model.ownerProtected
                          ? "Owner authority"
                          : permission.roleGranted
                            ? "Allowed"
                            : "Not allowed"}
                      </strong>
                    </div>

                    <div className="security-inheritance-state security-inheritance-state--personal">
                      <span className="security-state-label">
                        Personal setting
                      </span>
                      {model.ownerProtected ? (
                        <span className="security-state-badge">
                          System fixed
                        </span>
                      ) : (
                        <PersonalPermissionControl
                          userId={target.id}
                          permission={permission}
                          editable={canManagePersonal}
                        />
                      )}
                    </div>

                    <div className="security-inheritance-state security-inheritance-state--effective">
                      <span className="security-state-label">
                        Effective result
                      </span>
                      <strong
                        className={
                          permission.effective
                            ? "security-effective security-effective--allowed"
                            : "security-effective security-effective--denied"
                        }
                      >
                        {permission.effective ? "Allowed" : "Denied"}
                      </strong>
                      <small>{sourceLabel(permission, roleLabel)}</small>
                    </div>
                  </div>
                );
              })}
            </PermissionGroupSection>
          ))}
            </div>
          </>
        )}

        <ProtectedPermissionPanel
          lead="These powers are reserved for the Owner. They cannot be granted to an ordinary role, and no personal exception can grant them to one member."
          entries={model.protectedPermissions.map((permission) => ({
            key: permission.key,
            label: permission.label,
            description: permission.description,
            note: permission.effective ? "Allowed to Owner" : undefined,
          }))}
        />
      </div>
    </>
  );
}
