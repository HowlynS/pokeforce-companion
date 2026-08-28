"use client";

import { useLayoutEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { updatePersonalPermissionAction } from "@/app/admin/users/permission-actions";
import type {
  PersonalPermissionRowReadModel,
  PersonalPermissionSetting,
} from "@/lib/auth/permission-read-model";

const SETTINGS: readonly {
  value: PersonalPermissionSetting;
  label: string;
}[] = [
  { value: "INHERIT", label: "Use role setting" },
  { value: "ALLOW", label: "Allow" },
  { value: "DENY", label: "Deny" },
];

type SaveState =
  | { tone: "idle"; message: "" }
  | { tone: "success" | "error"; message: string };

export function PersonalPermissionControl({
  userId,
  permission,
  editable,
}: {
  userId: string;
  permission: PersonalPermissionRowReadModel;
  editable: boolean;
}) {
  const router = useRouter();
  const optionRefs = useRef<
    Partial<Record<PersonalPermissionSetting, HTMLButtonElement | null>>
  >({});
  const restoreFocusRef = useRef<PersonalPermissionSetting | null>(null);
  const [pending, startTransition] = useTransition();
  const [saveState, setSaveState] = useState<SaveState>({
    tone: "idle",
    message: "",
  });

  useLayoutEffect(() => {
    const setting = restoreFocusRef.current;
    if (setting) {
      optionRefs.current[setting]?.focus();
      restoreFocusRef.current = null;
    }
  }, [permission.personalSetting]);

  function select(setting: PersonalPermissionSetting) {
    if (setting === permission.personalSetting) {
      return;
    }
    restoreFocusRef.current = setting;
    setSaveState({ tone: "idle", message: "" });
    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.set("userId", userId);
        formData.set("permissionKey", permission.key);
        formData.set("effect", setting);
        const result = await updatePersonalPermissionAction(formData);

        if (!result.ok) {
          restoreFocusRef.current = null;
          setSaveState({ tone: "error", message: result.error });
          return;
        }

        setSaveState({
          tone: "success",
          message: result.changed ? "Saved" : "Already up to date",
        });
        router.refresh();
        requestAnimationFrame(() => optionRefs.current[setting]?.focus());
      } catch {
        restoreFocusRef.current = null;
        setSaveState({
          tone: "error",
          message: "The change could not be saved.",
        });
      }
    });
  }

  if (!editable) {
    return (
      <span
        className={
          permission.personalSetting === "ALLOW"
            ? "security-state-badge security-state-badge--allowed"
            : permission.personalSetting === "DENY"
              ? "security-state-badge security-state-badge--denied"
              : "security-state-badge"
        }
      >
        {permission.personalSetting === "INHERIT"
          ? "Use role setting"
          : permission.personalSetting === "ALLOW"
            ? "Personal allow"
            : "Personal deny"}
      </span>
    );
  }

  return (
    <div
      className="security-personal-control"
      aria-busy={pending || undefined}
    >
      <div
        className="security-personal-options"
        role="group"
        aria-label={`Personal setting for ${permission.label}`}
      >
        {SETTINGS.map((setting) => (
          <button
            ref={(node) => {
              optionRefs.current[setting.value] = node;
            }}
            key={setting.value}
            type="button"
            className="security-personal-option"
            data-setting={setting.value}
            aria-pressed={permission.personalSetting === setting.value}
            disabled={pending}
            onClick={() => select(setting.value)}
          >
            {setting.label}
          </button>
        ))}
      </div>
      {pending ? (
        <span className="security-control-message" role="status">
          Saving…
        </span>
      ) : saveState.message ? (
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
