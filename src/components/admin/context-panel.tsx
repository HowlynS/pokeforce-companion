// Shared contextual panel (Slice 9B.2; icon-bubble heading added in the
// Admin Editor Section Redesign pass): the bordered card the workspace
// aside column is built from — image, verification, and timestamp
// content all sit inside one of these. Title as a real heading (h2, so
// panels slot under the page's h1), optional description, a content
// slot, and an optional footer/action area separated by a rule. An
// optional `icon` renders the SAME icon-bubble treatment the main
// editor's own EditorSection cards use, but in its compact variant —
// this panel's own size, padding, and every existing behavior stay
// exactly as they were; only the heading row gains the small bubble
// beside its title when a caller supplies one. Every current caller
// (Image/Verification/Timestamps/Danger zone panels, plus a handful of
// read-only relationship views) still works unchanged when `icon` is
// omitted.

import type { LucideIcon } from "lucide-react";
import { SectionIcon } from "@/components/admin/section-icon";

type ContextPanelProps = {
  title: string;
  icon?: LucideIcon;
  description?: string;
  footer?: React.ReactNode;
  /** Appended alongside the base "admin-panel" class (e.g. the Danger
      zone's own danger-tinted border/heading) — never a replacement. */
  className?: string;
  children: React.ReactNode;
};

export function ContextPanel({
  title,
  icon,
  description,
  footer,
  className,
  children,
}: ContextPanelProps) {
  return (
    <section className={className ? `admin-panel ${className}` : "admin-panel"}>
      <div className="admin-panel-heading">
        {icon ? <SectionIcon icon={icon} compact /> : null}
        <h2 className="admin-panel-title">{title}</h2>
      </div>

      {description ? (
        <p className="admin-panel-description">{description}</p>
      ) : null}

      <div className="admin-panel-body">{children}</div>

      {footer ? <div className="admin-panel-footer">{footer}</div> : null}
    </section>
  );
}
