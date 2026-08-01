"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { requirePermission } from "@/lib/auth/authorization";
import { isUserRole } from "@/lib/auth/roles";
import { normalizeEmail } from "@/lib/auth/bootstrap-owner";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  createManagedUserAccount,
  ManagedAccountCreationError,
} from "@/lib/users/account-creation";
import {
  UserManagementError,
  changeUserRole,
  setUserStatus,
  validateUserStatusChange,
  validatePasswordReset,
  validateUserCreation,
} from "@/lib/users/service";
import { auditActor, writeAuditEvent } from "@/lib/audit/writer";

const USERS_PATH = "/admin/users";
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validPassword(password: string): boolean {
  return password.length >= 12 && password.length <= 128;
}

function managementErrorPath(error: unknown): string {
  if (error instanceof UserManagementError) {
    return `${USERS_PATH}?error=${error.code}`;
  }
  return `${USERS_PATH}?error=operation_failed`;
}

export async function createUserAction(formData: FormData) {
  const { user: actor } = await requirePermission("users.create");
  const email = normalizeEmail(String(formData.get("email") ?? ""));
  const displayName = String(formData.get("displayName") ?? "").trim();
  const password = String(formData.get("temporaryPassword") ?? "");
  const requestedRole = String(formData.get("role") ?? "");

  if (!EMAIL_PATTERN.test(email)) redirect(`${USERS_PATH}?error=invalid_email`);
  if (displayName.length > 80) redirect(`${USERS_PATH}?error=invalid_name`);
  if (!validPassword(password)) redirect(`${USERS_PATH}?error=invalid_password`);
  if (!isUserRole(requestedRole)) redirect(`${USERS_PATH}?error=invalid_role`);

  try {
    await validateUserCreation(prisma, actor.id, requestedRole);
  } catch (error) {
    redirect(managementErrorPath(error));
  }

  if (await prisma.appUser.findUnique({ where: { email } })) {
    redirect(`${USERS_PATH}?error=duplicate_email`);
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    redirect(`${USERS_PATH}?error=service_unavailable`);
  }

  try {
    const created = await createManagedUserAccount(
      {
        createAuthUser: async (input) => {
          const { data, error } = await admin.auth.admin.createUser({
            email: input.email,
            password: input.password,
            email_confirm: true,
            user_metadata: input.displayName
              ? { display_name: input.displayName }
              : undefined,
          });
          if (error || !data.user) throw new Error("auth_create_failed");
          return { id: data.user.id };
        },
        createApplicationUser: async (input) => {
          // Re-check after the cross-system Auth call so stale permissions
          // trigger compensation instead of creating an application user.
          await validateUserCreation(prisma, actor.id, requestedRole);
          return prisma.appUser.create({ data: input });
        },
        deleteAuthUser: async (authUserId) => {
          const { error } = await admin.auth.admin.deleteUser(authUserId);
          return !error;
        },
      },
      {
        email,
        password,
        displayName: displayName || null,
        role: requestedRole,
        createdById: actor.id,
      }
    );
    await writeAuditEvent(prisma, {
      actor: auditActor(actor),
      action: "access.user_create",
      targetType: "USER",
      targetId: created.id,
      targetLabel: created.email,
      metadata: { role: created.role },
    });
  } catch (error) {
    if (
      error instanceof ManagedAccountCreationError &&
      error.code === "creation_recovery_required"
    ) {
      console.error("Account creation compensation failed; manual recovery is required.");
      redirect(`${USERS_PATH}?error=creation_recovery_required`);
    }
    redirect(
      error instanceof ManagedAccountCreationError &&
        error.code === "account_creation_failed"
        ? `${USERS_PATH}?error=account_creation_failed`
        : `${USERS_PATH}?error=duplicate_email`
    );
  }

  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?success=user_created`);
}

export async function changeUserRoleAction(formData: FormData) {
  const { user: actor } = await requirePermission("users.modify");
  const targetId = String(formData.get("userId") ?? "");
  const role = String(formData.get("role") ?? "");
  if (!targetId) redirect(`${USERS_PATH}?error=missing_user`);
  if (!isUserRole(role)) redirect(`${USERS_PATH}?error=invalid_role`);
  if (formData.get("confirmed") !== "on") {
    redirect(`${USERS_PATH}?error=confirmation_required`);
  }

  try {
    await changeUserRole(prisma, actor.id, targetId, role);
  } catch (error) {
    redirect(managementErrorPath(error));
  }
  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?success=role_changed`);
}

export async function setUserStatusAction(formData: FormData) {
  const { user: actor } = await requirePermission("users.modify");
  const targetId = String(formData.get("userId") ?? "");
  const requestedStatus = String(formData.get("status") ?? "");
  if (!targetId) redirect(`${USERS_PATH}?error=missing_user`);
  if (requestedStatus !== "ACTIVE" && requestedStatus !== "DISABLED") {
    redirect(`${USERS_PATH}?error=invalid_status`);
  }
  if (formData.get("confirmed") !== "on") {
    redirect(`${USERS_PATH}?error=confirmation_required`);
  }

  let target;
  try {
    target = await validateUserStatusChange(
      prisma,
      actor.id,
      targetId,
      requestedStatus
    );
  } catch (error) {
    redirect(managementErrorPath(error));
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    redirect(`${USERS_PATH}?error=service_unavailable`);
  }

  if (requestedStatus === "ACTIVE") {
    const { error } = await admin.auth.admin.updateUserById(target.authUserId, {
      ban_duration: "none",
    });
    if (error) redirect(`${USERS_PATH}?error=reenable_failed`);
  }

  try {
    await setUserStatus(prisma, actor.id, targetId, requestedStatus);
  } catch (error) {
    redirect(managementErrorPath(error));
  }

  if (requestedStatus === "DISABLED") {
    const { error } = await admin.auth.admin.updateUserById(target.authUserId, {
      ban_duration: "876000h",
    });
    revalidatePath(USERS_PATH);
    redirect(
      error
        ? `${USERS_PATH}?success=user_disabled_session_warning`
        : `${USERS_PATH}?success=user_disabled`
    );
  }

  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?success=user_reenabled`);
}

export async function resetUserPasswordAction(formData: FormData) {
  const { user: actor } = await requirePermission("users.password.reset");
  const targetId = String(formData.get("userId") ?? "");
  const password = String(formData.get("temporaryPassword") ?? "");
  if (!targetId) redirect(`${USERS_PATH}?error=missing_user`);
  if (!validPassword(password)) redirect(`${USERS_PATH}?error=invalid_password`);
  if (formData.get("confirmed") !== "on") {
    redirect(`${USERS_PATH}?error=confirmation_required`);
  }

  let target;
  try {
    target = await validatePasswordReset(prisma, actor.id, targetId);
  } catch (error) {
    redirect(managementErrorPath(error));
  }

  let admin;
  try {
    admin = createSupabaseAdminClient();
  } catch {
    redirect(`${USERS_PATH}?error=service_unavailable`);
  }
  const { error } = await admin.auth.admin.updateUserById(target.authUserId, {
    password,
  });
  if (error) redirect(`${USERS_PATH}?error=password_reset_failed`);

  await writeAuditEvent(prisma, {
    actor: auditActor(actor),
    action: "access.password_reset",
    targetType: "USER",
    targetId: target.id,
    targetLabel: target.email,
    metadata: { administrative: true },
  });

  revalidatePath(USERS_PATH);
  redirect(`${USERS_PATH}?success=password_reset`);
}
