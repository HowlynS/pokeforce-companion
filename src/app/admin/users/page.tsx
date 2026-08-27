import { PageHeader } from "@/components/layout/page-header";
import { EditorSection } from "@/components/admin/editor-section";
import { AdminSelect } from "@/components/admin/admin-select";
import { EmptyState } from "@/components/ui/empty-state";
import { UsersAccessTabs } from "@/components/admin/users-access-tabs";
import { requirePermission } from "@/lib/auth/authorization";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { assignableRoles, canManageUser } from "@/lib/users/policy";
import { resolveSiteVisibility } from "@/lib/access/visibility";
import { changeSiteVisibilityAction } from "./visibility-actions";
import {
  changeUserRoleAction,
  createUserAction,
  resetUserPasswordAction,
  setUserStatusAction,
} from "./actions";

export const dynamic = "force-dynamic";

const errorMessages: Record<string, string> = {
  invalid_email: "Enter a valid email address.",
  invalid_name: "Display name must be 80 characters or fewer.",
  invalid_password: "Temporary passwords must be 12 to 128 characters.",
  invalid_role: "Select one of the four supported roles.",
  invalid_status: "Select an active or disabled status.",
  duplicate_email: "An account with that email already exists.",
  permission_denied: "You may not manage that account or assign that role.",
  missing_user: "That application user no longer exists.",
  final_owner: "The final active Owner cannot be disabled or demoted.",
  confirmation_required: "Confirm the account change before submitting.",
  service_unavailable: "Account administration is not configured on this server.",
  account_creation_failed: "The account could not be created.",
  creation_recovery_required:
    "Account creation could not be completed or fully rolled back. Check Supabase Auth before retrying.",
  reenable_failed: "The account could not be re-enabled in authentication.",
  password_reset_failed: "The temporary password could not be set.",
  operation_failed: "The account change could not be completed.",
  invalid_visibility: "Select Private beta or Public.",
  visibility_update_failed: "Site visibility could not be changed.",
};

const successMessages: Record<string, string> = {
  user_created: "Account created.",
  role_changed: "Role updated.",
  user_disabled: "Account disabled and authentication blocked.",
  user_disabled_session_warning:
    "Account disabled. Existing requests are blocked, but authentication session revocation needs attention.",
  user_reenabled: "Account re-enabled.",
  password_reset: "Temporary password updated. Share it outside the application.",
  visibility_private_beta: "Site visibility changed to Private beta.",
  visibility_public: "Site visibility changed to Public.",
};

type UsersPageProps = {
  searchParams: Promise<{
    q?: string;
    role?: string;
    status?: string;
    error?: string;
    success?: string;
  }>;
};

export default async function UsersPage({ searchParams }: UsersPageProps) {
  const { user: actor } = await requirePermission("users.view");
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const role = USER_ROLES.includes(params.role as UserRole)
    ? (params.role as UserRole)
    : null;
  const status = params.status === "ACTIVE" || params.status === "DISABLED"
    ? params.status
    : null;

  const [users, settings, recentAccessEvents] = await Promise.all([
    prisma.appUser.findMany({ where: {
      ...(query
        ? {
            OR: [
              { email: { contains: query, mode: "insensitive" as const } },
              { displayName: { contains: query, mode: "insensitive" as const } },
            ],
          }
        : {}),
      ...(role ? { role } : {}),
      ...(status ? { status } : {}),
    },
      include: { createdBy: { select: { email: true, displayName: true } } },
      orderBy: [{ status: "asc" }, { role: "desc" }, { email: "asc" }],
    }),
    prisma.siteAccessSettings.findUnique({ where: { id: "site" } }),
    prisma.auditEvent.findMany({
      where: { action: { startsWith: "access." } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);
  const storedVisibility = settings?.visibility ?? "PRIVATE_BETA";
  const effectiveVisibility = resolveSiteVisibility(
    storedVisibility,
    process.env.FORCE_PRIVATE_BETA
  );
  const roles = assignableRoles(actor.role);
  const errorMessage = params.error
    ? errorMessages[params.error] ?? "The account operation failed."
    : null;
  const successMessage = params.success
    ? successMessages[params.success] ?? null
    : null;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Site administration"
        title="Users & access"
        description="Manage the small set of approved private-beta accounts. Accounts are created manually; there is no signup or invitation flow."
      />

      {errorMessage ? <p role="alert" className="banner banner-error">{errorMessage}</p> : null}
      {successMessage ? <p role="status" className="banner banner-success">{successMessage}</p> : null}

      <UsersAccessTabs active="members" />

      <div className="admin-gameversions-layout">
        <EditorSection title="Approved accounts" icon={SECTION_ICONS.identity}>
          <form method="get" className="form-grid form-grid-responsive" style={{ marginBottom: "20px" }}>
            <label className="form-field">
              <span className="form-field-label">Search</span>
              <input className="form-input" type="search" name="q" defaultValue={query} placeholder="Email or display name" />
            </label>
            <label className="form-field">
              <span className="form-field-label">Role</span>
              <AdminSelect name="role" defaultValue={role ?? ""} options={[
                { value: "", label: "All roles" },
                ...USER_ROLES.map((value) => ({ value, label: USER_ROLE_LABELS[value] })),
              ]} />
            </label>
            <label className="form-field">
              <span className="form-field-label">Status</span>
              <AdminSelect name="status" defaultValue={status ?? ""} options={[
                { value: "", label: "All statuses" },
                { value: "ACTIVE", label: "Active" },
                { value: "DISABLED", label: "Disabled" },
              ]} />
            </label>
            <button type="submit" className="btn btn-secondary">Apply filters</button>
          </form>

          {users.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>Account</th><th>Role</th><th>Status</th><th>Created</th><th>Management</th></tr></thead>
                <tbody>
                  {users.map((target) => {
                    const manageable = canManageUser(actor, target);
                    const targetRoles = assignableRoles(actor.role);
                    return (
                      <tr key={target.id}>
                        <td>
                          <strong>{target.displayName || target.email}</strong>
                          {target.displayName ? <span className="admin-table-meta">{target.email}</span> : null}
                          {target.createdBy ? <span className="admin-table-meta">Created by {target.createdBy.displayName || target.createdBy.email}</span> : null}
                          {target.lastKnownSignInAt ? <span className="admin-table-meta">Last sign-in {formatDisplayDate(target.lastKnownSignInAt)}</span> : null}
                        </td>
                        <td>{USER_ROLE_LABELS[target.role]}</td>
                        <td><span className={target.status === "ACTIVE" ? "admin-status-badge admin-status-badge-current" : "admin-status-badge admin-status-badge-outdated"}>{target.status === "ACTIVE" ? "Active" : "Disabled"}</span></td>
                        <td>{formatDisplayDate(target.createdAt)}</td>
                        <td>
                          {manageable ? (
                            <div className="form-grid" style={{ minWidth: "280px" }}>
                              <form action={changeUserRoleAction} className="form-grid">
                                <input type="hidden" name="userId" value={target.id} />
                                <AdminSelect name="role" defaultValue={target.role} options={targetRoles.map((value) => ({ value, label: USER_ROLE_LABELS[value] }))} />
                                <label className="form-checkbox-field"><input type="checkbox" name="confirmed" required /><span>Confirm role change</span></label>
                                <button type="submit" className="btn btn-secondary btn-compact">Update role</button>
                              </form>
                              <form action={setUserStatusAction} className="form-grid">
                                <input type="hidden" name="userId" value={target.id} />
                                <input type="hidden" name="status" value={target.status === "ACTIVE" ? "DISABLED" : "ACTIVE"} />
                                <label className="form-checkbox-field"><input type="checkbox" name="confirmed" required /><span>Confirm {target.status === "ACTIVE" ? "disable" : "re-enable"}</span></label>
                                <button type="submit" className={target.status === "ACTIVE" ? "btn btn-danger-outline btn-compact" : "btn btn-secondary btn-compact"}>{target.status === "ACTIVE" ? "Disable account" : "Re-enable account"}</button>
                              </form>
                              <form action={resetUserPasswordAction} className="form-grid">
                                <input type="hidden" name="userId" value={target.id} />
                                <label className="form-field"><span className="form-field-label">New temporary password</span><input className="form-input" type="password" name="temporaryPassword" minLength={12} maxLength={128} required autoComplete="new-password" /></label>
                                <label className="form-checkbox-field"><input type="checkbox" name="confirmed" required /><span>Confirm password reset</span></label>
                                <button type="submit" className="btn btn-secondary btn-compact">Set temporary password</button>
                              </form>
                            </div>
                          ) : <span className="text-muted">Not manageable by your role</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : <EmptyState title="No matching accounts" description="Adjust the filters or create an approved account." />}
        </EditorSection>

        <EditorSection title="Create account" icon={SECTION_ICONS.identity}>
          <form action={createUserAction} className="form-grid">
            <label className="form-field"><span className="form-field-label">Email</span><input className="form-input" type="email" name="email" required autoComplete="off" /></label>
            <label className="form-field"><span className="form-field-label">Display name (optional)</span><input className="form-input" type="text" name="displayName" maxLength={80} /></label>
            <label className="form-field"><span className="form-field-label">Role</span><AdminSelect name="role" defaultValue={roles[0] ?? "MEMBER"} options={roles.map((value) => ({ value, label: USER_ROLE_LABELS[value] }))} /></label>
            <label className="form-field"><span className="form-field-label">Temporary password</span><input className="form-input" type="password" name="temporaryPassword" minLength={12} maxLength={128} required autoComplete="new-password" /><span className="form-help">Share outside the application and ask the user to change it immediately.</span></label>
            <button type="submit" className="btn btn-primary">Create approved account</button>
          </form>
        </EditorSection>

        {actor.role === "OWNER" ? (
          <EditorSection title="Site visibility" icon={SECTION_ICONS.verification}>
            <p className="text-muted">
              Stored mode: {storedVisibility === "PUBLIC" ? "Public" : "Private beta"}.
              Effective mode: {effectiveVisibility === "PUBLIC" ? "Public" : "Private beta"}.
              {storedVisibility !== effectiveVisibility
                ? " The server-level forced-private override is active."
                : ""}
            </p>
            <form action={changeSiteVisibilityAction} className="form-grid">
              <input type="hidden" name="visibility" value={storedVisibility === "PUBLIC" ? "PRIVATE_BETA" : "PUBLIC"} />
              <p>
                {storedVisibility === "PUBLIC"
                  ? "Switching to Private beta immediately removes anonymous access to ordinary reference content."
                  : "Switching to Public makes ordinary reference content anonymously accessible. Admin and account pages remain protected."}
              </p>
              <label className="form-checkbox-field">
                <input type="checkbox" name="confirmed" required />
                <span>I understand this site-wide access change</span>
              </label>
              <button type="submit" className="btn btn-primary">
                Switch to {storedVisibility === "PUBLIC" ? "Private beta" : "Public"}
              </button>
            </form>
          </EditorSection>
        ) : null}

        <EditorSection title="Recent access history" icon={SECTION_ICONS.timestamps}>
          {recentAccessEvents.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table">
                <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Target</th></tr></thead>
                <tbody>{recentAccessEvents.map((event) => (
                  <tr key={event.id}>
                    <td>{formatDisplayDate(event.createdAt)}</td>
                    <td>{event.actorDisplayNameSnapshot || event.actorEmailSnapshot}</td>
                    <td>{event.action.replaceAll(".", " · ")}</td>
                    <td>{event.targetLabelSnapshot}</td>
                  </tr>
                ))}</tbody>
              </table>
            </div>
          ) : <EmptyState title="No access events yet" description="Account and visibility changes will appear here." />}
        </EditorSection>
      </div>
    </>
  );
}
