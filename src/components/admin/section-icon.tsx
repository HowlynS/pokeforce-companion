// Shared section-icon bubble (Admin Editor Section Redesign pass): the
// one small outlined bubble every section/panel heading across the admin
// surface uses — never a bare icon. Purely decorative: the adjacent
// heading text always already names the section, so the whole bubble is
// aria-hidden and never independently focusable or interactive (a plain
// <span>, not a <button> or <a>). One shared component so every bubble
// shares the exact same dimensions, border, and icon size everywhere —
// never redefined per page. `compact` renders the smaller variant the
// context rail's own denser panels (Image/Verification/Timestamps/Danger
// zone) use; the main editor's own section cards use the default size.

import type { LucideIcon } from "lucide-react";

type SectionIconProps = {
  icon: LucideIcon;
  compact?: boolean;
};

export function SectionIcon({ icon: Icon, compact = false }: SectionIconProps) {
  return (
    <span
      aria-hidden="true"
      className={
        compact
          ? "admin-section-icon admin-section-icon-compact"
          : "admin-section-icon"
      }
    >
      <Icon />
    </span>
  );
}
