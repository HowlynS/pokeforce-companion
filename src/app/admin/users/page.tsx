import { PageHeader } from "@/components/layout/page-header";
import { EditorSection } from "@/components/admin/editor-section";
import { AdminSelect } from "@/components/admin/admin-select";
import { UsersAccessTabs } from "@/components/admin/users-access-tabs";
import { EmptyState } from "@/components/ui/empty-state";
import { requirePermission } from "@/lib/auth/authorization";
import { hasEffectivePermission } from "@/lib/auth/permission-resolver";
import { USER_ROLES, USER_ROLE_LABELS, type UserRole } from "@/lib/auth/roles";
import { prisma } from "@/lib/db";
import { formatDisplayDate } from "@/lib/format-date";
import { SECTION_ICONS } from "@/lib/admin/section-icons";
import { assignableRoles } from "@/lib/users/policy";
import { resolveSiteVisibility } from "@/lib/access/visibility";
import { changeSiteVisibilityAction } from "./visibility-actions";
import { createUserAction } from "./actions";
import {
  USER_MANAGEMENT_ERROR_MESSAGES,
  USER_MANAGEMENT_SUCCESS_MESSAGES,
} from "./messages";

export const dynamic = "force-dynamic";

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
  const { user: actor, permissionContext } = await requirePermission("users.view");
  const params = await searchParams;
  const query = params.q?.trim().slice(0, 100) ?? "";
  const role = USER_ROLES.includes(params.role as UserRole)
    ? (params.role as UserRole)
    : null;
  const status =
    params.status === "ACTIVE" || params.status === "DISABLED"
      ? params.status
      : null;
  const canCreate = hasEffectivePermission(
    permissionContext,
    "security.members.create"
  );
  const canManageVisibility = hasEffectivePermission(
    permissionContext,
    "site.visibility.manage"
  );

  const [users, settings] = await Promise.all([
    prisma.appUser.findMany({
      where: {
        ...(query
          ? {
              OR: [
                { email: { contains: query, mode: "insensitive" as const } },
                {
                  displayName: {
                    contains: query,
                    mode: "insensitive" as const,
                  },
                },
              ],
            }
          : {}),
        ...(role ? { role } : {}),
        ...(status ? { status } : {}),
      },
      include: { createdBy: { select: { email: true, displayName: true } } },
      orderBy: [{ status: "asc" }, { role: "desc" }, { email: "asc" }],
    }),
    canManageVisibility
      ? prisma.siteAccessSettings.findUnique({ where: { id: "site" } })
      : Promise.resolve(null),
  ]);
  const storedVisibility = settings?.visibility ?? "PRIVATE_BETA";
  const effectiveVisibility = resolveSiteVisibility(
    storedVisibility,
    process.env.FORCE_PRIVATE_BETA
  );
  const roles = assignableRoles(actor.role);
  const errorMessage = params.error
    ? USER_MANAGEMENT_ERROR_MESSAGES[params.error] ??
      "The account operation failed."
    : null;
  const successMessage = params.success
    ? USER_MANAGEMENT_SUCCESS_MESSAGES[params.success] ?? null
    : null;
  const hasOwnerTools = canCreate || canManageVisibility;

  return (
    <>
      <PageHeader
        eyebrow="Admin · Site administration"
        title="Users & access"
        description="Find approved members, inspect their effective access, and open one account for security management."
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

      <div
        className={
          hasOwnerTools
            ? "security-directory-layout"
            : "security-directory-layout security-directory-layout--single"
        }
      >
        <EditorSection
          title="Member directory"
          icon={SECTION_ICONS.identity}
          description={`${users.length} matching ${users.length === 1 ? "member" : "members"}`}
        >
          <form method="get" className="security-directory-filters">
            <label className="form-field">
              <span className="form-field-label">Search</span>
              <input
                className="form-input"
                type="search"
                name="q"
                defaultValue={query}
                placeholder="Email or display name"
              />
            </label>
            <label className="form-field">
              <span className="form-field-label">Role</span>
              <AdminSelect
                name="role"
                defaultValue={role ?? ""}
                options={[
                  { value: "", label: "All roles" },
                  ...USER_ROLES.map((value) => ({
                    value,
                    label: USER_ROLE_LABELS[value],
                  })),
                ]}
              />
            </label>
            <label className="form-field">
              <span className="form-field-label">Status</span>
              <AdminSelect
                name="status"
                defaultValue={status ?? ""}
                options={[
                  { value: "", label: "All statuses" },
                  { value: "ACTIVE", label: "Active" },
                  { value: "DISABLED", label: "Disabled" },
                ]}
              />
            </label>
            <button type="submit" className="btn btn-secondary">
              Apply filters
            </button>
          </form>

          {users.length ? (
            <div className="admin-table-wrap">
              <table className="admin-table security-directory-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Role</th>
                    <th>Status</th>
                    <th>Last activity</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((target) => (
                    <tr key={target.id}>
                      <td>
                        <div className="security-directory-identity">
                          <a
                            href={`/admin/users/${target.id}`}
                            className="security-directory-open"
                            aria-label={`Open ${target.displayName || target.email}`}
                          >
                            {target.displayName || target.email}
                          </a>
                          {target.displayName ? (
                            <span className="admin-table-meta">{target.email}</span>
                          ) : null}
                          <span className="admin-table-meta">
                            Created {formatDisplayDate(target.createdAt)}
                            {target.createdBy
                              ? ` by ${target.createdBy.displayName || target.createdBy.email}`
                              : ""}
                          </span>
                        </div>
                      </td>
                      <td>
                        <span
                          className={
                            target.role === "OWNER"
                              ? "security-role-tag security-role-tag--owner"
                              : "security-role-tag"
                          }
                        >
                          {USER_ROLE_LABELS[target.role]}
                        </span>
                      </td>
                      <td>
                        <span
                          className={
                            target.status === "ACTIVE"
                              ? "admin-status-badge admin-status-badge-current"
                              : "admin-status-badge admin-status-badge-outdated"
                          }
                        >
                          {target.status === "ACTIVE" ? "Active" : "Disabled"}
                        </span>
                      </td>
                      <td>
                        {target.lastKnownSignInAt
                          ? formatDisplayDate(target.lastKnownSignInAt)
                          : "No sign-in recorded"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState
              title="No matching members"
              description="Adjust the directory filters to find an approved account."
            />
          )}
        </EditorSection>

        {hasOwnerTools ? (
          <aside className="security-directory-tools" aria-label="Owner tools">
            {canCreate ? (
              <EditorSection
                title="Create account"
                icon={SECTION_ICONS.identity}
                description="Provision an approved ordinary member."
              >
                <form action={createUserAction} className="form-grid">
                  <label className="form-field">
                    <span className="form-field-label">Email</span>
                    <input className="form-input" type="email" name="email" required autoComplete="off" />
                  </label>
                  <label className="form-field">
                    <span className="form-field-label">Display name (optional)</span>
                    <input className="form-input" type="text" name="displayName" maxLength={80} />
                  </label>
                  <label className="form-field">
                    <span className="form-field-label">Role</span>
                    <AdminSelect
                      name="role"
                      defaultValue={roles[0] ?? "MEMBER"}
                      options={roles.map((value) => ({
                        value,
                        label: USER_ROLE_LABELS[value],
                      }))}
                    />
                  </label>
                  <label className="form-field">
                    <span className="form-field-label">Temporary password</span>
                    <input className="form-input" type="password" name="temporaryPassword" minLength={12} maxLength={128} required autoComplete="new-password" />
                    <span className="form-help">
                      Share outside the application and require an immediate change.
                    </span>
                  </label>
                  <button type="submit" className="btn btn-primary">
                    Create approved account
                  </button>
                </form>
              </EditorSection>
            ) : null}

            {canManageVisibility ? (
              <EditorSection
                title="Site visibility"
                icon={SECTION_ICONS.verification}
                description="Owner-protected public access control."
              >
                <p className="security-visibility-summary">
                  <strong>
                    The Codex is currently{" "}
                    {effectiveVisibility === "PUBLIC" ? "public" : "in private beta"}.
                  </strong>
                  {storedVisibility !== effectiveVisibility ? (
                    <>
                      <br />
                      <span className="text-muted">
                        A server setting is holding it there, so the choice
                        saved here —{" "}
                        {storedVisibility === "PUBLIC" ? "public" : "private beta"}{" "}
                        — is not in effect.
                      </span>
                    </>
                  ) : null}
                </p>
                <form action={changeSiteVisibilityAction} className="form-grid">
                  <input
                    type="hidden"
                    name="visibility"
                    value={storedVisibility === "PUBLIC" ? "PRIVATE_BETA" : "PUBLIC"}
                  />
                  <p>
                    {storedVisibility === "PUBLIC"
                      ? "Private beta removes anonymous reference access."
                      : "Public allows anonymous reference access; admin pages stay protected."}
                  </p>
                  <label className="form-checkbox-field">
                    <input type="checkbox" name="confirmed" required />
                    <span>I understand this site-wide access change</span>
                  </label>
                  <button type="submit" className="btn btn-secondary">
                    Switch to {storedVisibility === "PUBLIC" ? "Private beta" : "Public"}
                  </button>
                </form>
              </EditorSection>
            ) : null}
          </aside>
        ) : null}
      </div>
    </>
  );
}
