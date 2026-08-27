"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type {
  OrdinaryUserRole,
  RolePermissionRowReadModel,
} from "@/lib/auth/permission-read-model";
import { USER_ROLE_LABELS } from "@/lib/auth/roles";
import { updateRolePermissionAction } from "@/app/admin/users/permission-actions";

type SaveState =
  | { tone: "idle"; message: "" }
  | { tone: "success" | "error"; message: string };

export function RolePermissionControl({
  role,
  permission,
  editable,
}: {
  role: OrdinaryUserRole;
  permission: RolePermissionRowReadModel;
  editable: boolean;
}) {
  const router = useRouter();
  const buttonRef = useRef<HTMLButtonElement>(null);
  const restoreFocusRef = useRef(false);
  const [saveState, setSaveState] = useState<SaveState>({
    tone: "idle",
    message: "",
  });
  const [pending, startTransition] = useTransition();

  useLayoutEffect(() => {
    if (restoreFocusRef.current) {
      buttonRef.current?.focus();
      restoreFocusRef.current = false;
    }
  }, [permission.granted]);

  function toggle() {
    const nextGranted = !permission.granted;
    restoreFocusRef.current = true;
    setSaveState({ tone: "idle", message: "" });
    startTransition(async () => {
      const formData = new FormData();
      formData.set("role", role);
      formData.set("permissionKey", permission.key);
      formData.set("operation", nextGranted ? "grant" : "revoke");
      const result = await updateRolePermissionAction(formData);

      if (!result.ok) {
        restoreFocusRef.current = false;
        setSaveState({ tone: "error", message: result.error });
        return;
      }

      setSaveState({
        tone: "success",
        message: result.changed ? "Saved" : "Already up to date",
      });
      router.refresh();
      requestAnimationFrame(() => buttonRef.current?.focus());
    });
  }

  return (
    <div
      className="security-permission-control"
      aria-busy={pending || undefined}
    >
      {editable ? (
        <button
          ref={buttonRef}
          type="button"
          className="security-permission-toggle"
          aria-pressed={permission.granted}
          aria-label={`${permission.granted ? "Remove" : "Allow"} ${permission.label} for ${USER_ROLE_LABELS[role]}`}
          disabled={pending}
          onClick={toggle}
        >
          <span aria-hidden="true" className="security-permission-toggle-track">
            <span className="security-permission-toggle-thumb" />
          </span>
          <span>{pending ? "Saving…" : permission.granted ? "Allowed" : "Not allowed"}</span>
        </button>
      ) : (
        <span
          className={
            permission.granted
              ? "security-state-badge security-state-badge--allowed"
              : "security-state-badge"
          }
        >
          {permission.granted ? "Allowed" : "Not allowed"}
        </span>
      )}

      {saveState.message ? (
        <span
          className={`security-control-message security-control-message--${saveState.tone}`}
          role={saveState.tone === "error" ? "alert" : "status"}
        >
          {saveState.message}
        </span>
      ) : null}
    </div>
  );
}
